"""Secret handling: encryption at rest, masking, log redaction, passwords."""

from __future__ import annotations

from cryptography.fernet import Fernet

from app.core.logging import REDACTED, _redact, scrub_text
from app.core.security import SecretBox, hash_password, mask_secret, verify_password


def test_secret_box_round_trip_and_tamper_detection() -> None:
    box = SecretBox(Fernet.generate_key())
    token = box.encrypt("sk-live-abc123")
    assert "sk-live" not in token
    assert box.decrypt(token) == "sk-live-abc123"
    assert SecretBox(Fernet.generate_key()).decrypt(token) is None


def test_mask_secret_never_reveals_the_key() -> None:
    assert mask_secret("sk-proj-1234567890abcd") == "sk-…abcd"
    assert mask_secret("short") == "••••"


def test_log_redaction_by_key_and_by_pattern() -> None:
    event = _redact(
        None,
        "info",
        {
            "event": "calling with sk-proj-ABCDEFGH12345678",
            "api_key": "anything",
            "access_token": "abc",
            "output_tokens": 42,
            "headers": {"Authorization": "Bearer abcdefghijkl"},
            "message": "key AIzaSyA1234567890abcdefghijk leaked",
        },
    )
    assert event["api_key"] == REDACTED
    assert event["access_token"] == REDACTED
    assert event["output_tokens"] == 42
    assert event["headers"]["Authorization"] == REDACTED
    assert "sk-proj" not in event["event"]
    assert "AIza" not in event["message"]
    assert scrub_text("Incorrect API key provided: sk-abc***wxyz.") == f"Incorrect API key provided: {REDACTED}"


def test_password_hashing() -> None:
    hashed = hash_password("correct horse battery")
    assert hashed != "correct horse battery"
    assert verify_password(hashed, "correct horse battery")
    assert not verify_password(hashed, "wrong")
    assert not verify_password("not-a-hash", "anything")


def test_list_settings_accept_comma_separated_env(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com, https://b.example.com")
    monkeypatch.setenv("TRUSTED_HOSTS", '["a.example.com"]')
    settings = Settings()
    assert settings.cors_origins == ["https://a.example.com", "https://b.example.com"]
    assert settings.trusted_hosts == ["a.example.com"]
