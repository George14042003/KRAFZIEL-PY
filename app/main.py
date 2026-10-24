import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import auth, candidate_portal, candidates, jobs, public, signaling, super_admin

app = FastAPI(title="N.A.I.E API")

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")
os.makedirs(os.path.join(MEDIA_ROOT, "recordings"), exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")

extra_origins = [
    origin.strip()
    for origin in os.environ.get("EXTRA_CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3003", *extra_origins],
    allow_origin_regex=r"https://.*\.ngrok-free\.(dev|app)|https://.*\.ngrok\.(io|app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(candidates.router)
app.include_router(jobs.router)
app.include_router(candidate_portal.router)
app.include_router(signaling.router)
app.include_router(super_admin.router)
app.include_router(public.router)


@app.get("/health")
def health():
    return {"status": "ok"}
