"""Structured logging with secret redaction.

All log events pass through :func:`_redact` which removes values for keys that look
sensitive and scrubs anything resembling an API key from free-text values. This is a
defence-in-depth measure — code should never pass secrets to the logger in the first
place.
"""

from __future__ import annotations

import logging
import re
import sys
from typing import Any

import structlog

# Whole-key matches only: "access_token" is sensitive, "output_tokens" is not.
_SENSITIVE_KEYS = re.compile(
    r"^(?:.*[_-])?(api[_-]?key|key|token|secret|password|passwd|authorization|cookie|credentials?)$", re.I
)
_KEY_PATTERNS = re.compile(r"(sk-[A-Za-z0-9_\-*.]{3,}|AIza[0-9A-Za-z_\-]{20,}|Bearer\s+[A-Za-z0-9._\-]{8,})")
REDACTED = "[REDACTED]"


def scrub_text(value: str) -> str:
    return _KEY_PATTERNS.sub(REDACTED, value)


def _redact_value(key: str, value: Any) -> Any:
    if _SENSITIVE_KEYS.match(key):
        return REDACTED
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, dict):
        return {k: _redact_value(str(k), v) for k, v in value.items()}
    return value


def _redact(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    return {key: (value if key == "event" else _redact_value(key, value)) for key, value in event_dict.items()} | {
        "event": scrub_text(str(event_dict.get("event", "")))
    }


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    shared: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _redact,
    ]
    renderer: Any = structlog.processors.JSONRenderer() if json_logs else structlog.dev.ConsoleRenderer()
    structlog.configure(
        processors=[*shared, structlog.processors.format_exc_info, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level.upper())),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(level=level.upper(), stream=sys.stdout, format="%(levelname)s %(name)s: %(message)s")
    # Third-party HTTP clients can log full request URLs/headers at DEBUG.
    for noisy in ("httpx", "httpx2", "httpcore", "openai", "anthropic", "google_genai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)  # type: ignore[no-any-return]
