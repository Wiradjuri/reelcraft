"""Simple in-process sliding-window rate limiter.

Adequate for a single API instance. For horizontally-scaled deployments, swap the
implementation behind :class:`RateLimiter` for a shared store (e.g. Redis) — callers
only depend on :meth:`RateLimiter.hit`.
"""

from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from threading import Lock

from app.core.errors import RateLimited


class RateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: float = 60.0) -> None:
        """Record an event for ``key``; raise :class:`RateLimited` if over ``limit``."""
        if limit <= 0:
            return
        now = time.monotonic()
        with self._lock:
            events = self._events[key]
            while events and now - events[0] > window_seconds:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, math.ceil(window_seconds - (now - events[0])))
                raise RateLimited(retry_after=retry_after)
            events.append(now)

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


rate_limiter = RateLimiter()
