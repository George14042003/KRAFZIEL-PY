"""Optional application-layer encryption of API request bodies and JSON responses, with keys that rotate.

Off by default. ENCRYPT_API=optional turns it on for clients that ask for it; =required also refuses plaintext
JSON request bodies. It sits on top of TLS, it does not replace it, and it cannot hide anything from the person
whose browser is making the request: that browser must hold the key to read its own data.

Handshake (POST /secure/handshake): the client sends an ephemeral ECDH P-256 public key; the server answers with
its own ephemeral key, a key id (kid), a salt and a random lifetime of 5 to 10 minutes. Both sides derive an
AES-256-GCM key with HKDF-SHA256, so every key is unrelated to the previous one and is never sent over the wire.

Per request the client sends X-Enc-Kid (it can read encrypted responses) and X-Enc-Rid (a random request id), and
X-Enc-Body: 1 when the JSON body is an envelope {iv, ct}. Keys live in this process's memory only, so with more
than one server process the clients must reach the same process (or the keys must move to shared storage)."""

import base64
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass, field

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

MIN_LIFETIME_SECONDS = 300
MAX_LIFETIME_SECONDS = 600
GRACE_SECONDS = 30
CLOCK_SKEW_SECONDS = 120
MAX_KEYS = 20000
MAX_BODY_BYTES = 5 * 1024 * 1024
INFO_PREFIX = b"krafziel-transport-v1|"

# Never touched, whatever the mode: file/stream/websocket/webhook/open-API routes and the handshake itself.
EXCLUDED_PREFIXES = ("/media", "/ws", "/health", "/open", "/secure", "/billing/webhook", "/docs", "/redoc", "/openapi.json")


def mode() -> str:
    value = os.environ.get("ENCRYPT_API", "off").strip().lower()
    return value if value in ("optional", "required") else "off"


def b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


@dataclass
class TransportKey:
    kid: str
    aes: AESGCM
    expires_at: float
    seen: dict[str, float] = field(default_factory=dict)


_keys: dict[str, TransportKey] = {}
_lock = threading.Lock()


def _purge(now: float) -> None:
    for kid in [k for k, v in _keys.items() if v.expires_at + GRACE_SECONDS < now]:
        del _keys[kid]
    while len(_keys) > MAX_KEYS:
        del _keys[min(_keys, key=lambda k: _keys[k].expires_at)]


def handshake(client_pub_b64: str) -> dict:
    """Derive a fresh key for this client and return what it needs to derive the same one."""
    client_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), b64d(client_pub_b64))
    server_priv = ec.generate_private_key(ec.SECP256R1())
    shared = server_priv.exchange(ec.ECDH(), client_pub)
    kid = b64e(secrets.token_bytes(12))
    salt = secrets.token_bytes(32)
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=INFO_PREFIX + kid.encode()).derive(shared)
    lifetime = MIN_LIFETIME_SECONDS + secrets.randbelow(MAX_LIFETIME_SECONDS - MIN_LIFETIME_SECONDS + 1)
    now = time.time()
    with _lock:
        _purge(now)
        _keys[kid] = TransportKey(kid=kid, aes=AESGCM(key), expires_at=now + lifetime)
    server_pub = server_priv.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return {
        "enabled": True,
        "kid": kid,
        "pub": b64e(server_pub),
        "salt": b64e(salt),
        "lifetime": lifetime,
        "expires_at": int((now + lifetime) * 1000),
        "mode": mode(),
    }


def get_key(kid: str) -> TransportKey | None:
    now = time.time()
    with _lock:
        key = _keys.get(kid)
        if key is None or key.expires_at + GRACE_SECONDS < now:
            return None
        return key


def request_aad(method: str, path: str) -> bytes:
    return f"v1|{method.upper()}|{path}".encode()


def response_aad(status: int, rid: str, path: str) -> bytes:
    return f"v1|resp|{status}|{rid}|{path}".encode()


class EncryptionError(Exception):
    pass


def open_request(key: TransportKey, envelope: bytes, method: str, path: str, rid: str) -> bytes:
    """Decrypt a request envelope and enforce freshness and one-time use. Returns the original body bytes."""
    try:
        env = json.loads(envelope)
        plain = key.aes.decrypt(b64d(env["iv"]), b64d(env["ct"]), request_aad(method, path))
        inner = json.loads(plain)
        sent_at, inner_rid, body = float(inner["t"]) / 1000.0, str(inner["r"]), inner["b"]
        if not isinstance(body, str):
            raise ValueError("body")
    except (InvalidTag, KeyError, ValueError, TypeError) as exc:
        raise EncryptionError("bad") from exc
    now = time.time()
    if inner_rid != rid:
        raise EncryptionError("bad")
    if abs(now - sent_at) > CLOCK_SKEW_SECONDS:
        raise EncryptionError("clock")
    with _lock:
        for r in [r for r, exp in key.seen.items() if exp < now]:
            del key.seen[r]
        if rid in key.seen:
            raise EncryptionError("replay")
        key.seen[rid] = now + 2 * CLOCK_SKEW_SECONDS
    return body.encode()


def seal_response(key: TransportKey, body: bytes, status: int, rid: str, path: str) -> bytes:
    iv = secrets.token_bytes(12)
    ct = key.aes.encrypt(iv, body, response_aad(status, rid, path))
    return json.dumps({"enc": "v1", "kid": key.kid, "iv": b64e(iv), "ct": b64e(ct)}, separators=(",", ":")).encode()


def is_excluded(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in EXCLUDED_PREFIXES)


class TransportCryptoMiddleware:
    """Pure ASGI, so bodies can be rewritten without buffering streams or file uploads that are excluded."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path: str = scope["path"]
        method: str = scope["method"]

        if path == "/secure/handshake" and method == "POST":
            return await self._handshake(receive, send)
        if mode() == "off" or is_excluded(path) or method == "OPTIONS":
            return await self.app(scope, receive, send)

        headers = {k.decode().lower(): v.decode("latin-1") for k, v in scope["headers"]}
        kid = headers.get("x-enc-kid")
        body_encrypted = headers.get("x-enc-body") == "1"
        ctype = headers.get("content-type", "").lower()

        if not kid:
            has_json_body = (
                method in ("POST", "PUT", "PATCH", "DELETE")
                and "application/json" in ctype
                and (headers.get("content-length", "0") != "0" or "transfer-encoding" in headers)
            )
            if mode() == "required" and has_json_body:
                return await self._plain(send, 428, {"detail": "This request must be encrypted."}, "required")
            return await self.app(scope, receive, send)

        key = get_key(kid)
        if key is None:
            return await self._plain(send, 428, {"detail": "Encryption key expired."}, "rekey")
        rid = headers.get("x-enc-rid", "")
        if not rid or len(rid) > 64:
            return await self._plain(send, 400, {"detail": "Missing request id."}, "bad")

        if body_encrypted:
            raw = bytearray()
            while True:
                message = await receive()
                raw.extend(message.get("body", b""))
                if len(raw) > MAX_BODY_BYTES:
                    return await self._plain(send, 413, {"detail": "Request too large."}, "bad")
                if not message.get("more_body"):
                    break
            try:
                plain_body = open_request(key, bytes(raw), method, path, rid)
            except EncryptionError as exc:
                return await self._plain(send, 400, {"detail": "The encrypted request could not be read."}, str(exc))
            sent = False

            async def receive_plain():
                nonlocal sent
                if sent:
                    return {"type": "http.request", "body": b"", "more_body": False}
                sent = True
                return {"type": "http.request", "body": plain_body, "more_body": False}

            scope = dict(scope)
            scope["headers"] = [(k, v) for k, v in scope["headers"] if k.lower() not in (b"content-length", b"x-enc-body")] + [
                (b"content-length", str(len(plain_body)).encode())
            ]
            receive = receive_plain

        start: dict = {}
        chunks: list[bytes] = []

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                start.update(message)
                return
            if message["type"] != "http.response.body":
                return await send(message)
            chunks.append(message.get("body", b""))
            if message.get("more_body"):
                return
            body = b"".join(chunks)
            resp_headers = list(start.get("headers", []))
            is_json = any(k.lower() == b"content-type" and b"application/json" in v.lower() for k, v in resp_headers)
            status = start.get("status", 200)
            if is_json and body and status not in (204, 304):
                body = seal_response(key, body, status, rid, path)
                resp_headers = [(k, v) for k, v in resp_headers if k.lower() != b"content-length"]
                resp_headers += [(b"content-length", str(len(body)).encode()), (b"x-enc", b"v1")]
            else:
                resp_headers = [(k, v) for k, v in resp_headers if k.lower() != b"content-length"] + [(b"content-length", str(len(body)).encode())]
            await send({"type": "http.response.start", "status": status, "headers": resp_headers})
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, send_wrapper)

    async def _handshake(self, receive, send):
        raw = bytearray()
        while True:
            message = await receive()
            raw.extend(message.get("body", b""))
            if len(raw) > 4096:
                return await self._plain(send, 413, {"detail": "Request too large."}, None)
            if not message.get("more_body"):
                break
        if mode() == "off":
            return await self._plain(send, 200, {"enabled": False}, None)
        try:
            result = handshake(json.loads(raw)["pub"])
        except Exception:
            return await self._plain(send, 400, {"detail": "Invalid handshake."}, None)
        await self._plain(send, 200, result, None)

    @staticmethod
    async def _plain(send, status: int, payload: dict, error: str | None):
        body = json.dumps(payload).encode()
        headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"cache-control", b"no-store")]
        if error:
            headers.append((b"x-enc-error", error.encode()))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})
