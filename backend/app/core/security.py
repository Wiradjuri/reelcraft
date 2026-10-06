"""Password hashing, session tokens and encryption of stored credentials."""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Session tokens are stored hashed so a database leak doesn't leak live sessions."""
    return hashlib.sha256(token.encode()).hexdigest()


class SecretBox:
    """Symmetric encryption for customer-supplied secrets (e.g. Bring-Your-Own-AI keys)."""

    def __init__(self, key: bytes) -> None:
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str | None:
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            return None


def mask_secret(secret: str) -> str:
    """Return a non-reversible hint such as ``sk-…a1b2`` for display."""
    if len(secret) <= 8:
        return "••••"
    prefix = secret[:3] if secret[:3].isalpha() or secret.startswith("sk-") else ""
    return f"{prefix}…{secret[-4:]}"
