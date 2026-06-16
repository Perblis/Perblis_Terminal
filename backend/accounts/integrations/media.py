"""Private document storage for verification docs (TSD §3.9).

Verification documents are sensitive and must NEVER be publicly reachable.
Two backends:

* ``r2``    — Cloudflare R2 (S3-compatible). Uploads go to the private bucket;
              reads are short-lived presigned GETs (15 min).
* ``local`` — dev/CI fallback when no R2 keys are set. Files live under
              ``MEDIA_ROOT/private``; "presigned" GETs are signed, expiring URLs
              to an Ops-only Django view (`accounts:private-doc`), so the
              "never publicly reachable" guarantee holds in both modes.

The local fallback deliberately does not touch the public bucket or
STATIC_URL — there is no code path that exposes a private key publicly.
"""

from __future__ import annotations

import functools
from pathlib import Path

import structlog
from django.conf import settings
from django.core import signing
from django.urls import reverse

logger = structlog.get_logger(__name__)

# Namespaced signer for local-mode presigned URLs.
_signer = signing.TimestampSigner(salt="accounts.private-doc")


def _is_r2() -> bool:
    return settings.PRIVATE_MEDIA_BACKEND == "r2"


@functools.lru_cache(maxsize=1)
def _r2_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET,
        region_name="auto",
    )


def _local_path(key: str) -> Path:
    base = Path(settings.MEDIA_ROOT) / "private"
    # Key segments are app-generated (uuid7-based); reject traversal defensively.
    target = (base / key).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise ValueError("Invalid private media key.")
    return target


def store_private_file(key: str, content: bytes, content_type: str) -> None:
    """Persist a document under `key` in the private store."""
    if _is_r2():
        _r2_client().put_object(
            Bucket=settings.R2_PRIVATE_BUCKET,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        logger.info("media.private_put_r2", key=key)
        return

    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    logger.info("media.private_put_local", key=key)


def read_private_file(key: str) -> bytes:
    """Read a stored document (R2 or local) — used by the Ops stream view."""
    if _is_r2():
        obj = _r2_client().get_object(Bucket=settings.R2_PRIVATE_BUCKET, Key=key)
        return obj["Body"].read()
    return _local_path(key).read_bytes()


def presign_get(key: str, ttl: int | None = None) -> str:
    """Return a short-lived URL to view a private document.

    R2: a genuine presigned S3 GET. Local: a signed, expiring URL to the
    Ops-only stream view. Never a public/static URL.
    """
    ttl = ttl or settings.R2_PRESIGN_TTL
    if _is_r2():
        return _r2_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.R2_PRIVATE_BUCKET, "Key": key},
            ExpiresIn=ttl,
        )
    token = _signer.sign(key)
    return reverse("api:accounts:private-doc") + f"?t={token}"


def unsign_local_token(token: str, max_age: int | None = None) -> str:
    """Validate a local-mode token and return the key (raises on bad/expired)."""
    max_age = max_age or settings.R2_PRESIGN_TTL
    return _signer.unsign(token, max_age=max_age)
