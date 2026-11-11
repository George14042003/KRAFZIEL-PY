"""Access control for uploaded media: recordings, identity snapshots and face scans.

Every media link the API hands out is signed and expires. The server only returns such links to people it has
already authorised (an employer at the candidate's company, or the call's participants), so a file can no longer be
opened by someone who merely learns or guesses its address. The /media files themselves are still served by the
static file handler (including video seeking); this middleware only decides whether a request may reach it.

Set MEDIA_REQUIRE_SIGNATURE=false to switch the check off (not recommended)."""

import hashlib
import hmac
import os
import time
from typing import Optional
from urllib.parse import parse_qs

MEDIA_PREFIX = "/media/"
DEFAULT_TTL_SECONDS = 6 * 60 * 60


def _key() -> bytes:
    secret = os.environ.get("SECRET_KEY", "")
    if not secret:
        raise RuntimeError("SECRET_KEY is required to sign media links.")
    return hashlib.sha256(b"krafziel-media-v1:" + secret.encode("utf-8")).digest()


def _mac(path: str, expires: int) -> str:
    return hmac.new(_key(), f"{path}\n{expires}".encode("utf-8"), hashlib.sha256).hexdigest()


def sign_media_url(url: Optional[str], ttl_seconds: int = DEFAULT_TTL_SECONDS) -> Optional[str]:
    """Add an expiry and signature to a /media/... link. Anything else (or an already signed link) is returned as is."""
    if not isinstance(url, str) or not url.startswith(MEDIA_PREFIX) or "?" in url:
        return url
    expires = int(time.time()) + ttl_seconds
    return f"{url}?exp={expires}&sig={_mac(url, expires)}"


def verify_media_request(path: str, query_string: bytes) -> bool:
    try:
        query = parse_qs(query_string.decode("utf-8", errors="ignore"))
        expires = int(query.get("exp", [""])[0])
        signature = query.get("sig", [""])[0]
    except (ValueError, IndexError):
        return False
    if expires < int(time.time()) or not signature:
        return False
    return hmac.compare_digest(signature, _mac(path, expires))


def _required() -> bool:
    return os.environ.get("MEDIA_REQUIRE_SIGNATURE", "true").strip().lower() not in ("0", "false", "no", "off")


class MediaAccessMiddleware:
    """Pure ASGI middleware: refuses /media requests that do not carry a valid, unexpired signature."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not (path.startswith(MEDIA_PREFIX) or path == "/media") or not _required():
            await self.app(scope, receive, send)
            return

        if not verify_media_request(path, scope.get("query_string", b"")):
            body = b'{"detail":"This link has expired or is not valid."}'
            await send(
                {
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                        (b"cache-control", b"no-store"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"cache-control", b"private, max-age=3600"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
