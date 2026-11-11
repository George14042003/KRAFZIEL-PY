"""Small in-memory attempt limiter for sign-in and password-reset requests.

It counts attempts per key (an email and role) inside a sliding window. State lives in this one server process, so it
resets on a restart and is not shared between several workers; it is a brake on guessing, not an audit log."""

import threading
import time
from collections import deque


class AttemptLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 50_000):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque:
        q = self._hits.get(key)
        if q is None:
            return deque()
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            self._hits.pop(key, None)
        return q

    def retry_after(self, key: str) -> int:
        """Seconds until another attempt is allowed, or 0 when the key is not blocked."""
        now = time.time()
        with self._lock:
            q = self._prune(key, now)
            if len(q) < self.limit:
                return 0
            return max(1, int(q[0] + self.window - now) + 1)

    def record(self, key: str) -> None:
        now = time.time()
        with self._lock:
            if len(self._hits) >= self.max_keys and key not in self._hits:
                oldest = min(self._hits, key=lambda k: self._hits[k][-1] if self._hits[k] else 0)
                self._hits.pop(oldest, None)
            self._prune(key, now)
            self._hits.setdefault(key, deque()).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
