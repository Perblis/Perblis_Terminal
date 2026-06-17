"""Application-level field encryption (TSD §3.3 — bank details at rest).

Sensitive columns (e.g. a supplier's bank account number) are Fernet-encrypted
before they touch the database, so a raw DB read never yields plaintext. The
key comes from ``FIELD_ENCRYPTION_KEY``; in dev/CI (no key set) we derive a
deterministic key from ``SECRET_KEY`` so the round-trip works without extra
config. **Prod must set ``FIELD_ENCRYPTION_KEY``** — a stable, secret value.

Fernet ciphertext is non-deterministic (random IV + timestamp); never filter or
index on an encrypted column.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _derive_key(secret: str) -> bytes:
    """Turn an arbitrary secret into a valid 32-byte url-safe Fernet key."""
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if key:
        raw = key.encode() if isinstance(key, str) else key
        try:
            return Fernet(raw)
        except (ValueError, TypeError):
            # A non-Fernet secret was supplied — derive a key from it.
            return Fernet(_derive_key(key if isinstance(key, str) else key.decode()))
    # Dev/CI fallback. Deterministic so values persist across a process restart.
    return Fernet(_derive_key(settings.SECRET_KEY))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt; return "" on a token we can't read (e.g. key rotated)."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""
