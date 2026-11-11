import os
import re
import uuid
from datetime import datetime

import httpx
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session, joinedload

from app import ai, models, schemas
from app.database import SessionLocal, get_db
from app.media_access import sign_media_url
from app.security import (
    get_current_user,
    interview_party,
    require_interview_participant,
    user_id_from_access_token,
)

router = APIRouter(tags=["signaling"])

# A call room is keyed by its interview's own UUID, and every joiner must
# confirm the email the interview concerns them under. This is the
# server-side guard against the obvious cheat of forwarding the interview
# link to someone else to sit in and answer instead of the real candidate:
# each of the two roles (candidate / employer) can only be occupied by one
# matching, verified email at a time — a second "candidate" (or "employer")
# trying to join once that role is taken is rejected outright, regardless of
# how many total connections the room would otherwise allow.
MAX_PEERS_PER_ROOM = 2
rooms: dict[str, dict[WebSocket, str]] = {}  # room_id -> {websocket: role}

TURN_KEY_ID = os.environ.get("TURN_KEY_ID")
TURN_API_TOKEN = os.environ.get("TURN_API_TOKEN")
TURN_CREDENTIAL_TTL_SECONDS = 14400  # 4 hours — comfortably covers a single call session

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "media")
RECORDINGS_DIR = os.path.join(MEDIA_ROOT, "recordings")
MAX_RECORDING_BYTES = 500 * 1024 * 1024  # 500MB safety cap per file
_SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")


@router.post("/interviews/{interview_id}/recording")
async def upload_recording(
    interview_id: str,
    participant: str = "participant",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_participant),
):
    """Receive a locally-recorded (own camera) clip from one side of a video
    call and store it on disk, appending its URL to the interview's
    recording_urls. Only the interview's own candidate or an employer at
    that organization may upload.
    """
    def _exists() -> bool:
        found = db.query(models.Interview.id).filter(models.Interview.id == interview_id).first() is not None
        # Release the connection the auth dependency left open: the upload below can take minutes
        # and must not pin a pool slot (or the event loop) while it streams.
        db.close()
        return found

    if not await run_in_threadpool(_exists):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")

    safe_participant = participant if _SAFE_ID.match(participant) else "participant"
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    ext = ".webm"
    filename = f"{interview_id}_{safe_participant}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(RECORDINGS_DIR, filename)

    size = 0
    out = await run_in_threadpool(open, dest_path, "wb")
    try:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_RECORDING_BYTES:
                await run_in_threadpool(out.close)
                await run_in_threadpool(os.remove, dest_path)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Recording too large.")
            await run_in_threadpool(out.write, chunk)
    finally:
        if not out.closed:
            await run_in_threadpool(out.close)

    url = f"/media/recordings/{filename}"

    def _save() -> None:
        interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
        if interview is None:
            return
        existing = list(interview.recording_urls or [])
        existing.append(url)
        interview.recording_urls = existing
        interview.updated_at = datetime.utcnow()
        db.commit()

    await run_in_threadpool(_save)

    return {"url": sign_media_url(url)}


# Below this, a live-call transcript (accumulated client-side from browser
# captions) is too thin to evaluate meaningfully — mirrors the same
# no-evaluation tolerance evaluate_soft_skills already has for missing input.
MIN_TRANSCRIPT_TURNS = 4
_RELAYED_TYPES = {"offer", "answer", "ice-candidate", "chat", "caption"}


@router.post("/interviews/{interview_id}/call-evaluation")
def submit_call_evaluation(
    interview_id: str,
    payload: schemas.CallEvaluationRequest,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_participant),
    current_user: models.User = Depends(get_current_user),
):
    """Receive the accumulated live-call caption transcript once the call ends
    and, if substantial enough, run it through the same AI evaluation pipeline
    bot interviews use, populating Interview.ai_evaluation. Only the employer side's transcript is used:
    the candidate controls their own client, so their copy must not be able to write the scorecard.
    """
    if interview_party(_access, current_user) != "employer":
        return {"evaluated": False}
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")

    if len(payload.transcript) < MIN_TRANSCRIPT_TURNS:
        return {"evaluated": False}

    turns = [{"speaker": t.speaker, "text": t.text} for t in payload.transcript]
    # Let go of the DB connection while the (slow, queued) AI call runs, then look the row up again.
    db.close()
    evaluation = ai.evaluate_call_transcript(turns)
    if evaluation is None:
        return {"evaluated": False}

    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if interview is None:
        return {"evaluated": False}
    interview.ai_evaluation = evaluation
    interview.updated_at = datetime.utcnow()
    db.commit()

    return {"evaluated": True}


@router.get("/turn-credentials")
async def get_turn_credentials(_user: models.User = Depends(get_current_user)):
    """Mint short-lived TURN credentials for a WebRTC call via Cloudflare Calls.
    Requires a logged-in user so the TURN quota can't be drained anonymously. The
    long-lived API token never leaves the server; only the short-lived minted
    credentials are returned.
    """
    if not TURN_KEY_ID or not TURN_API_TOKEN:
        return {"iceServers": [{"urls": "stun:stun.l.google.com:19302"}]}

    url = f"https://rtc.live.cloudflare.com/v1/turn/keys/{TURN_KEY_ID}/credentials/generate-ice-servers"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {TURN_API_TOKEN}"},
                json={"ttl": TURN_CREDENTIAL_TTL_SECONDS},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:
        print(f"[turn] credential mint failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not mint TURN credentials."
        )


def _resolve_join_role(
    db: Session, interview_id: str, token: str
) -> tuple[str | None, models.Interview | None]:
    """Which side of the interview the logged-in user holds (plus the interview row,
    so the caller can check consent/availability without a second query), or
    (None, None). Both sides prove who they are with their login token: the
    candidate by a verified account whose email matches the interview, the
    employer by belonging to the candidate's organization."""
    try:
        interview_uuid = uuid.UUID(interview_id)
    except ValueError:
        return None, None  # not an interview id: refuse instead of letting the query raise a 500
    interview = (
        db.query(models.Interview)
        .options(joinedload(models.Interview.candidate))
        .filter(models.Interview.id == interview_uuid)
        .first()
    )
    if interview is None or interview.candidate is None or not token:
        return None, None
    user_id = user_id_from_access_token(token)
    user = db.get(models.User, user_id) if user_id else None
    if user is None:
        return None, None
    role = interview_party(interview, user)
    return (role, interview) if role else (None, None)


@router.websocket("/ws/call/{room_id}")
async def call_signaling(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(""),
):
    # A call can last an hour: never hold a DB connection (a Depends(get_db) session) for that long,
    # or the pool is gone after a few concurrent calls. Look the participant up once and let go.
    def _resolve():
        with SessionLocal() as db:
            found_role, found = _resolve_join_role(db, room_id, token)
            if found_role is None:
                return None, None, None
            return found_role, found.availability_status, found.consent_accepted

    role, availability, consent = await run_in_threadpool(_resolve)
    if role is None:
        await websocket.accept()
        await websocket.send_json({"type": "unauthorized"})
        await websocket.close()
        return

    # The candidate side must have confirmed they're actually available for
    # this slot and accepted the consent form before joining — same gates the
    # bot-interview flow enforces. The employer side doesn't need either
    # (they scheduled the interview and aren't the one being recorded/consented).
    if role == "candidate" and availability != models.AvailabilityStatus.ACCEPTED:
        await websocket.accept()
        await websocket.send_json({"type": "not-confirmed"})
        await websocket.close()
        return
    if role == "candidate" and not consent:
        await websocket.accept()
        await websocket.send_json({"type": "consent-required"})
        await websocket.close()
        return

    await websocket.accept()
    peers = rooms.setdefault(room_id, {})

    if len(peers) >= MAX_PEERS_PER_ROOM:
        await websocket.send_json({"type": "room-full"})
        await websocket.close()
        return

    if role in peers.values():
        # Someone already joined as this same role (e.g. the real candidate
        # is already in the call, or already left but this email keeps
        # retrying) — a second person can't also be "the candidate" or "the
        # employer" in the same interview.
        await websocket.send_json({"type": "role-taken"})
        await websocket.close()
        return

    peers[websocket] = role
    is_initiator = len(peers) == MAX_PEERS_PER_ROOM
    await websocket.send_json({"type": "joined", "initiator": is_initiator, "role": role})

    async def relay_to_others(message: dict) -> None:
        # A peer's socket can go dead (network drop, tunnel blip) without the
        # server having noticed yet — sending to it would otherwise raise and
        # tear down *this* connection too. Treat a failed send as that peer
        # having left, and drop it from the room immediately so it doesn't
        # occupy a slot / block a fresh reconnect with "room-full".
        dead: list[WebSocket] = []
        for peer in peers:
            if peer is websocket:
                continue
            try:
                await peer.send_json(message)
            except Exception:
                dead.append(peer)
        for peer in dead:
            peers.pop(peer, None)

    await relay_to_others({"type": "peer-joined"})

    try:
        while True:
            message = await websocket.receive_json()
            # Only peer-to-peer messages are relayed; clients must not be able to forge server events.
            if isinstance(message, dict) and message.get("type") in _RELAYED_TYPES:
                await relay_to_others(message)
    except WebSocketDisconnect:
        pass
    finally:
        peers.pop(websocket, None)
        await relay_to_others({"type": "peer-left"})
        if not peers:
            rooms.pop(room_id, None)
