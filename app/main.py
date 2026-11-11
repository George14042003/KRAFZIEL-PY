import os

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.media_access import MediaAccessMiddleware
from app.transport_crypto import TransportCryptoMiddleware
from app.routers import (
    admin_billing,
    auth,
    billing,
    candidate_portal,
    candidates,
    jobs,
    mock_interviews,
    notifications,
    open_api,
    public,
    signaling,
    super_admin,
)

app = FastAPI(title="N.A.I.E API")


@app.on_event("startup")
async def _size_threadpool() -> None:
    # Every `def` endpoint (heartbeats, submits, scoring) runs on this pool; the default of 40 is
    # exhausted by a few dozen interviews finishing at once. Sized with DB_POOL_SIZE + DB_MAX_OVERFLOW.
    anyio.to_thread.current_default_thread_limiter().total_tokens = int(os.environ.get("THREADPOOL_SIZE", "200"))

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")
os.makedirs(os.path.join(MEDIA_ROOT, "recordings"), exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")

extra_origins = [
    origin.strip()
    for origin in os.environ.get("EXTRA_CORS_ORIGINS", "").split(",")
    if origin.strip()
]

# Optional payload/response encryption (ENCRYPT_API=optional|required; off by default). Added before CORS so
# CORS wraps it and its rekey/error responses still carry the CORS headers.
app.add_middleware(TransportCryptoMiddleware)

# Uploaded media (recordings, face scans, snapshots) is only reachable through signed, expiring links.
app.add_middleware(MediaAccessMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3003", *extra_origins],
    allow_origin_regex=r"https://.*\.ngrok-free\.(dev|app)|https://.*\.ngrok\.(io|app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Enc", "X-Enc-Error"],
)

app.include_router(auth.router)
app.include_router(candidates.router)
app.include_router(notifications.router)
app.include_router(billing.router)
app.include_router(admin_billing.router)
app.include_router(mock_interviews.router)
app.include_router(jobs.router)
app.include_router(candidate_portal.router)
app.include_router(signaling.router)
app.include_router(super_admin.router)
app.include_router(public.router)
app.include_router(open_api.router)
app.include_router(open_api.ws_router)


@app.on_event("startup")
def _announce_open_api_key() -> None:
    if not open_api._configured_keys():
        print(f"[open-api] OPEN_API_KEYS not set; dev key: {open_api.default_dev_key()}")


@app.get("/health")
def health():
    return {"status": "ok"}
