"""Krafziel Open API: 1:1 video interview rooms as a standalone service.

Deliberately independent of the hiring app: no database, no accounts, and no AI/OpenAI calls.
  * A server holding an API key creates rooms and gets back one signed join token per participant.
  * Participants join with that token (browser WebRTC via the hosted page, or your own client).
  * Recordings are stored on disk under media/open-recordings/<room_id>/.

State (who is connected, which rooms were closed) lives in this process's memory, like the
existing call signaling, so run a single worker. Room identity and permissions live inside the
signed tokens, so a restart never invalidates a valid link.
"""
import hashlib
import hmac
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.media_access import sign_media_url

SECRET_KEY = os.environ["SECRET_KEY"]
TURN_KEY_ID = os.environ.get("TURN_KEY_ID")
TURN_API_TOKEN = os.environ.get("TURN_API_TOKEN")

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "media")
RECORDINGS_DIR = os.path.join(MEDIA_ROOT, "open-recordings")
MAX_RECORDING_BYTES = 500 * 1024 * 1024
MAX_ROOM_RECORDING_BYTES = 2 * 1024 * 1024 * 1024
MAX_ROOM_RECORDING_FILES = 20
MAX_PEERS = 2
MAX_PARTICIPANTS_PER_ROOM = 8  # tokens you can mint; only two can be connected at once
_ROOM_ID = re.compile(r"^[a-f0-9]{32}$")
_SAFE = re.compile(r"[^a-zA-Z0-9_-]")

router = APIRouter(prefix="/open/v1", tags=["open-api"])
ws_router = APIRouter(tags=["open-api"])

# room_id -> {websocket: participant_id}; closed rooms are refused until their tokens expire.
_rooms: dict[str, dict[WebSocket, str]] = {}
_closed: dict[str, datetime] = {}


def _configured_keys() -> list[str]:
    return [k.strip() for k in os.environ.get("OPEN_API_KEYS", "").split(",") if k.strip()]


def default_dev_key() -> str:
    """Stable key derived from SECRET_KEY, used only when OPEN_API_KEYS is not set."""
    return "maata_open_" + hmac.new(SECRET_KEY.encode(), b"open-api-dev-key", hashlib.sha256).hexdigest()[:32]


def _valid_keys() -> list[str]:
    return _configured_keys() or [default_dev_key()]


def require_api_key(x_api_key: str = Header("", alias="X-API-Key"), authorization: str = Header("")) -> str:
    supplied = x_api_key or (authorization[7:] if authorization.lower().startswith("bearer ") else "")
    if not supplied or not any(hmac.compare_digest(supplied, k) for k in _valid_keys()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key. Send it as the X-API-Key header.",
        )
    return supplied


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _mint_token(room_id: str, pid: str, name: str, role: str, expires_at: datetime) -> str:
    return jwt.encode(
        {"typ": "open-room", "room": room_id, "pid": pid, "name": name, "role": role, "exp": expires_at},
        SECRET_KEY,
        algorithm="HS256",
    )


def _read_token(token: str, room_id: str | None = None) -> dict:
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This join link has expired.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid join token.")
    if claims.get("typ") != "open-room" or (room_id and claims.get("room") != room_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token does not belong to this room.")
    if claims["room"] in _closed:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This room has been closed.")
    return claims


def _check_room_id(room_id: str) -> None:
    if not _ROOM_ID.match(room_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")


def _public_base(request: Request) -> str:
    configured = os.environ.get("OPEN_PUBLIC_URL") or os.environ.get("FRONTEND_URL")
    if configured:
        return configured.rstrip("/")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    return f"{proto}://{host}"


class ParticipantIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80, examples=["Priya Shah"])
    role: str = Field("guest", max_length=30, examples=["host"])


class CreateRoomIn(BaseModel):
    participants: list[ParticipantIn] = Field(
        default_factory=lambda: [ParticipantIn(name="Host", role="host"), ParticipantIn(name="Guest", role="guest")],
        min_length=1,
        max_length=MAX_PARTICIPANTS_PER_ROOM,
    )
    expires_in_minutes: int = Field(120, ge=5, le=60 * 24 * 7)
    metadata: dict | None = Field(None, description="Echoed back on reads; never shown to participants.")


class TokenIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    role: str = Field("guest", max_length=30)


def _participant_out(request: Request, room_id: str, name: str, role: str, expires_at: datetime) -> dict:
    pid = uuid.uuid4().hex[:12]
    token = _mint_token(room_id, pid, name, role, expires_at)
    return {
        "id": pid,
        "name": name,
        "role": role,
        "token": token,
        "join_url": f"{_public_base(request)}/open-room/{room_id}?token={token}",
    }


@router.get("")
def info():
    return {
        "service": "Krafziel Open API",
        "version": "1",
        "ai": False,
        "description": "1:1 video interview rooms. No accounts, no database, no AI.",
        "docs": "/open-source",
    }


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
def create_room(body: CreateRoomIn, request: Request, _key: str = Depends(require_api_key)):
    room_id = uuid.uuid4().hex
    expires_at = _now() + timedelta(minutes=body.expires_in_minutes)
    return {
        "room_id": room_id,
        "created_at": _now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "metadata": body.metadata,
        "participants": [_participant_out(request, room_id, p.name, p.role, expires_at) for p in body.participants],
    }


@router.post("/rooms/{room_id}/tokens", status_code=status.HTTP_201_CREATED)
def add_participant(
    room_id: str,
    body: TokenIn,
    request: Request,
    expires_in_minutes: int = Query(120, ge=5, le=60 * 24 * 7),
    _key: str = Depends(require_api_key),
):
    """Mint another join link for an existing room (for example to re-invite someone)."""
    _check_room_id(room_id)
    if room_id in _closed:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This room has been closed.")
    expires_at = _now() + timedelta(minutes=expires_in_minutes)
    return _participant_out(request, room_id, body.name, body.role, expires_at)


def _room_dir(room_id: str) -> str:
    return os.path.join(RECORDINGS_DIR, room_id)


def _recordings(room_id: str) -> list[dict]:
    folder = _room_dir(room_id)
    if not os.path.isdir(folder):
        return []
    out = []
    for fn in sorted(os.listdir(folder)):
        full = os.path.join(folder, fn)
        out.append(
            {
                "file": fn,
                "url": sign_media_url(f"/media/open-recordings/{room_id}/{fn}"),
                "bytes": os.path.getsize(full),
                "recorded_at": datetime.fromtimestamp(os.path.getmtime(full), timezone.utc).isoformat(),
            }
        )
    return out


@router.get("/rooms/{room_id}")
def get_room(room_id: str, _key: str = Depends(require_api_key)):
    _check_room_id(room_id)
    return {
        "room_id": room_id,
        "closed": room_id in _closed,
        "connected": len(_rooms.get(room_id, {})),
        "max_connected": MAX_PEERS,
        "recordings": _recordings(room_id),
    }


@router.delete("/rooms/{room_id}", status_code=status.HTTP_200_OK)
async def close_room(room_id: str, _key: str = Depends(require_api_key)):
    """End the room: disconnects everyone and rejects every token for it from now on."""
    _check_room_id(room_id)
    now = _now()
    for stale in [r for r, at in _closed.items() if now - at > timedelta(days=7)]:  # tokens live at most 7 days
        _closed.pop(stale, None)
    _closed[room_id] = now
    for ws in list(_rooms.get(room_id, {})):
        try:
            await ws.send_json({"type": "room-closed"})
            await ws.close()
        except Exception:
            pass
    _rooms.pop(room_id, None)
    return {"room_id": room_id, "closed": True}


@router.get("/rooms/{room_id}/recordings")
def list_recordings(room_id: str, _key: str = Depends(require_api_key)):
    _check_room_id(room_id)
    return {"room_id": room_id, "recordings": _recordings(room_id)}


@router.post("/rooms/{room_id}/recordings", status_code=status.HTTP_201_CREATED)
async def upload_recording(room_id: str, token: str = Query(...), file: UploadFile = File(...)):
    """A participant uploads their own locally recorded clip (webm). Authenticated by join token."""
    _check_room_id(room_id)
    claims = _read_token(token, room_id)
    folder = _room_dir(room_id)
    await run_in_threadpool(os.makedirs, folder, exist_ok=True)
    filename = f"{_SAFE.sub('', claims['pid'])}_{_SAFE.sub('', claims['role']) or 'guest'}_{secrets.token_hex(4)}.webm"
    dest = os.path.join(folder, filename)

    existing = [os.path.join(folder, n) for n in await run_in_threadpool(os.listdir, folder)]
    used = sum(os.path.getsize(p) for p in existing if os.path.isfile(p))
    if len(existing) >= MAX_ROOM_RECORDING_FILES or used >= MAX_ROOM_RECORDING_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Room recording quota reached.")

    size = 0
    out = await run_in_threadpool(open, dest, "wb")
    try:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_RECORDING_BYTES or used + size > MAX_ROOM_RECORDING_BYTES:
                await run_in_threadpool(out.close)
                await run_in_threadpool(os.remove, dest)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Recording too large.")
            await run_in_threadpool(out.write, chunk)
    finally:
        if not out.closed:
            await run_in_threadpool(out.close)
    return {"url": sign_media_url(f"/media/open-recordings/{room_id}/{filename}"), "bytes": size}


@router.get("/ice-servers")
async def ice_servers(token: str = Query(...)):
    """ICE/TURN servers for a participant. Requires a valid join token, so the quota can't be drained anonymously."""
    _read_token(token)
    if not TURN_KEY_ID or not TURN_API_TOKEN:
        return {"iceServers": [{"urls": "stun:stun.l.google.com:19302"}]}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://rtc.live.cloudflare.com/v1/turn/keys/{TURN_KEY_ID}/credentials/generate-ice-servers",
                headers={"Authorization": f"Bearer {TURN_API_TOKEN}"},
                json={"ttl": 14400},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:
        print(f"[turn] credential mint failed: {exc}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not mint TURN credentials.")


@ws_router.websocket("/ws/open/{room_id}")
async def open_signaling(websocket: WebSocket, room_id: str, token: str = Query("")):
    """WebRTC signaling relay. Messages are forwarded verbatim to the other participant.

    Server events: joined {initiator, role, name}, peer-joined {name, role}, peer-left,
    room-full, already-connected, room-closed, unauthorized {reason}.
    """
    try:
        if not _ROOM_ID.match(room_id):
            raise HTTPException(status_code=404, detail="Room not found.")
        claims = _read_token(token, room_id)
    except HTTPException as exc:
        await websocket.accept()
        await websocket.send_json({"type": "unauthorized", "reason": exc.detail})
        await websocket.close()
        return

    await websocket.accept()
    peers = _rooms.setdefault(room_id, {})
    pid = claims["pid"]

    if pid in peers.values():
        await websocket.send_json({"type": "already-connected"})
        await websocket.close()
        return
    if len(peers) >= MAX_PEERS:
        await websocket.send_json({"type": "room-full"})
        await websocket.close()
        return

    peers[websocket] = pid
    await websocket.send_json({"type": "joined", "initiator": len(peers) == MAX_PEERS, "role": claims["role"], "name": claims["name"]})

    async def relay(message: dict) -> None:
        dead = []
        for peer in list(peers):
            if peer is websocket:
                continue
            try:
                await peer.send_json(message)
            except Exception:
                dead.append(peer)
        for peer in dead:
            peers.pop(peer, None)

    await relay({"type": "peer-joined", "name": claims["name"], "role": claims["role"]})

    try:
        while True:
            message = await websocket.receive_json()
            # Clients may only relay WebRTC negotiation, not impersonate server events.
            if isinstance(message, dict) and message.get("type") in {"offer", "answer", "ice-candidate", "chat"}:
                await relay(message)
    except WebSocketDisconnect:
        pass
    finally:
        peers.pop(websocket, None)
        await relay({"type": "peer-left"})
        if not peers:
            _rooms.pop(room_id, None)
