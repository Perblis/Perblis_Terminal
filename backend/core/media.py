"""Generic media pipeline — kind-scoped presigned uploads (TSD §3.9).

Clients never stream bytes through the API. They ask for a short-lived
presigned PUT for a validated ``(kind, content_type, file_size)``, upload the
bytes directly to object storage, then attach the returned ``key`` to the
owning resource (a listing photo, a supplier logo, …).

Two logical buckets:

* **public**  — logos, avatars, listing photos. Readable at a stable URL
  (``R2_PUBLIC_BASE_URL`` in prod; a local serve view in dev).
* **private** — verification documents (``accounts.integrations.media``) and
  handover photos (D-025 — FSD §7.4: parties + Ops only). Never publicly
  reachable; reads are short-lived presigned GETs minted where authorization
  is enforced (the handover serializer / the Ops review queue).

When R2 keys are absent (dev/CI) the presigned PUT points at a local,
token-authorised receiver view so the upload→attach round-trip still works
end-to-end without external storage. This simulates the integration; it never
simulates trust.
"""

from __future__ import annotations

import functools
from dataclasses import dataclass
from pathlib import Path

import structlog
from django.conf import settings
from django.core import signing
from django.urls import reverse
from rest_framework import status

from core.exceptions import TerminalError
from core.ids import uuid7

logger = structlog.get_logger(__name__)

MB = 1024 * 1024
_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


@dataclass(frozen=True)
class MediaKind:
    name: str
    bucket: str  # "public" | "private"
    max_bytes: int
    content_types: tuple[str, ...]
    prefix: str


# Caps per TSD §3.9.
MEDIA_KINDS: dict[str, MediaKind] = {
    mk.name: mk
    for mk in (
        MediaKind("listing_photo", "public", 10 * MB, _IMAGE_TYPES, "listings"),
        MediaKind("avatar", "public", 2 * MB, _IMAGE_TYPES, "avatars"),
        MediaKind("logo", "public", 2 * MB, _IMAGE_TYPES, "logos"),
        MediaKind(
            "verification_doc",
            "private",
            5 * MB,
            (*_IMAGE_TYPES, "application/pdf"),
            "verification",
        ),
        # Private per D-025 (FSD §7.4): handover evidence is parties + Ops only.
        MediaKind("handover_photo", "private", 10 * MB, _IMAGE_TYPES, "handovers"),
    )
}


class MediaKindInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "media_kind_invalid"
    default_detail = "Unknown media kind."


class MediaContentTypeInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "media_content_type_invalid"
    default_detail = "Unsupported content type for this media kind."


class MediaTooLarge(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "media_too_large"
    default_detail = "File exceeds the maximum size for this media kind."


# Signs local-mode upload tokens (dev/CI fallback only).
_signer = signing.TimestampSigner(salt="core.media-upload")


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


def _public_is_r2() -> bool:
    return bool(settings.R2_ACCOUNT_ID and settings.R2_PUBLIC_BUCKET)


def _private_is_r2() -> bool:
    return settings.PRIVATE_MEDIA_BACKEND == "r2"


def r2_usage() -> dict | None:
    """Best-effort R2 storage usage for the weekly digest (TSD §9).

    Sums object sizes across the public + private buckets via ``list_objects_v2``.
    R2 exposes no clean per-request usage API, so this is storage-only and
    best-effort: returns ``None`` when R2 isn't configured or on any error.
    """
    if not (_public_is_r2() or _private_is_r2()):
        return None
    buckets = [b for b in {settings.R2_PUBLIC_BUCKET, settings.R2_PRIVATE_BUCKET} if b]
    try:
        client = _r2_client()
        total = 0
        objects = 0
        for bucket in buckets:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket):
                for obj in page.get("Contents", []):
                    total += obj.get("Size", 0)
                    objects += 1
    except Exception:  # storage stats are best-effort; never fail the digest
        logger.exception("media.r2_usage_failed")
        return None
    return {"bytes": total, "objects": objects, "mb": round(total / (1024 * 1024), 1)}


def _local_public_path(key: str) -> Path:
    base = Path(settings.MEDIA_ROOT) / "public"
    target = (base / key).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise ValueError("Invalid public media key.")
    return target


def presign_upload(*, kind: str, content_type: str, file_size: int) -> dict:
    """Validate the request and return ``{key, bucket, presigned_put_url, expires_in}``."""
    mk = MEDIA_KINDS.get(kind)
    if mk is None:
        raise MediaKindInvalid()
    if content_type not in mk.content_types:
        raise MediaContentTypeInvalid()
    if not file_size or file_size <= 0 or file_size > mk.max_bytes:
        raise MediaTooLarge()

    ext = _EXT.get(content_type, "bin")
    key = f"{mk.prefix}/{uuid7()}.{ext}"
    ttl = settings.MEDIA_UPLOAD_TTL
    is_r2 = _public_is_r2() if mk.bucket == "public" else _private_is_r2()

    if is_r2:
        bucket_name = (
            settings.R2_PUBLIC_BUCKET if mk.bucket == "public" else settings.R2_PRIVATE_BUCKET
        )
        url = _r2_client().generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket_name, "Key": key, "ContentType": content_type},
            ExpiresIn=ttl,
        )
    else:
        url = _local_put_url(key, mk.bucket)

    logger.info("media.presign", kind=kind, bucket=mk.bucket, key=key)
    return {"key": key, "bucket": mk.bucket, "presigned_put_url": url, "expires_in": ttl}


def _local_put_url(key: str, bucket: str) -> str:
    token = _signer.sign(f"{bucket}:{key}")
    return reverse("api:media-upload") + f"?t={token}"


def parse_local_upload_token(token: str, max_age: int | None = None) -> tuple[str, str]:
    raw = _signer.unsign(token, max_age=max_age or settings.MEDIA_UPLOAD_TTL)
    bucket, _, key = raw.partition(":")
    return bucket, key


def public_url(key: str) -> str:
    """A readable URL for a public-bucket object (empty string for no key)."""
    if not key:
        return ""
    if _public_is_r2():
        return f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{key}"
    return reverse("api:media-public") + f"?key={key}"


def delete_public_file(key: str) -> None:
    """Remove a public-bucket object; a missing key is a no-op (idempotent)."""
    if _public_is_r2():
        _r2_client().delete_object(Bucket=settings.R2_PUBLIC_BUCKET, Key=key)
        return
    _local_public_path(key).unlink(missing_ok=True)


def store_public_file(key: str, content: bytes, content_type: str) -> None:
    if _public_is_r2():
        _r2_client().put_object(
            Bucket=settings.R2_PUBLIC_BUCKET, Key=key, Body=content, ContentType=content_type
        )
        return
    path = _local_public_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def read_public_file(key: str) -> bytes:
    if _public_is_r2():
        obj = _r2_client().get_object(Bucket=settings.R2_PUBLIC_BUCKET, Key=key)
        return obj["Body"].read()
    return _local_public_path(key).read_bytes()


# --- private-bucket reads (handover photos, D-025) ---------------------------
# Verification docs keep their own Ops-only pipeline in
# ``accounts.integrations.media``; these helpers serve kinds whose presigned
# GET is minted for the resource's *parties* (authorization happens where the
# URL is issued — possession of the short-lived URL is the grant, exactly the
# R2 presigned-GET trust model, mirrored in local mode by a signed token).
_private_signer = signing.TimestampSigner(salt="core.media-private")


def _local_private_path(key: str) -> Path:
    base = Path(settings.MEDIA_ROOT) / "private"
    target = (base / key).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise ValueError("Invalid private media key.")
    return target


def private_presign_get(key: str, ttl: int | None = None) -> str:
    """A short-lived URL for a private object — never a public/static URL."""
    ttl = ttl or settings.R2_PRESIGN_TTL
    if _private_is_r2():
        return _r2_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.R2_PRIVATE_BUCKET, "Key": key},
            ExpiresIn=ttl,
        )
    token = _private_signer.sign(key)
    return reverse("api:media-private") + f"?t={token}"


def parse_private_get_token(token: str, max_age: int | None = None) -> str:
    """Validate a local-mode private-GET token and return the key (raises on bad/expired)."""
    return _private_signer.unsign(token, max_age=max_age or settings.R2_PRESIGN_TTL)


def read_private_file(key: str) -> bytes:
    if _private_is_r2():
        obj = _r2_client().get_object(Bucket=settings.R2_PRIVATE_BUCKET, Key=key)
        return obj["Body"].read()
    return _local_private_path(key).read_bytes()


def store_private_file(key: str, content: bytes, content_type: str) -> None:
    if _private_is_r2():
        _r2_client().put_object(
            Bucket=settings.R2_PRIVATE_BUCKET, Key=key, Body=content, ContentType=content_type
        )
        return
    path = _local_private_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def private_file_exists(key: str) -> bool:
    if _private_is_r2():
        try:
            _r2_client().head_object(Bucket=settings.R2_PRIVATE_BUCKET, Key=key)
            return True
        except Exception:  # noqa: BLE001 — head 404s raise ClientError
            return False
    return _local_private_path(key).exists()


def delete_private_file(key: str) -> None:
    """Remove a private-bucket object; a missing key is a no-op (idempotent)."""
    if _private_is_r2():
        _r2_client().delete_object(Bucket=settings.R2_PRIVATE_BUCKET, Key=key)
        return
    _local_private_path(key).unlink(missing_ok=True)
