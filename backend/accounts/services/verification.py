"""Verification: submit documents and Ops approve/reject.

Documents go to the PRIVATE store (R2 or local fallback) — only object keys are
persisted on the request. Approval upgrades the account level; rejection
requires a reason; both notify the user. Resubmission is allowed once the prior
request is decided (enforced by the partial-unique constraint on pending rows).
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from accounts.enums import VerificationKind, VerificationState
from accounts.errors import VerificationDocInvalid, VerificationPending
from accounts.integrations import media
from accounts.models import AccountLevel, User, VerificationRequest
from accounts.tasks import send_verification_email
from core.ids import uuid7

# Which account level each kind of approved verification grants. Keyed/valued
# by the canonical string values (mirrors VerificationKind / AccountLevel).
ACCOUNT_LEVEL_TARGETS: dict[str, str] = {
    str(VerificationKind.IDENTITY): str(AccountLevel.VERIFIED),
    str(VerificationKind.BUSINESS): str(AccountLevel.BUSINESS_VERIFIED),
}

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
}
MAX_DOC_BYTES = 5 * 1024 * 1024  # 5 MB


def _validate_and_store(user: User, request_id, files: list) -> list[str]:
    if not files:
        raise VerificationDocInvalid(detail="At least one document is required.")
    keys: list[str] = []
    for f in files:
        ext = ALLOWED_CONTENT_TYPES.get(getattr(f, "content_type", "") or "")
        if ext is None:
            raise VerificationDocInvalid(detail="Documents must be JPEG, PNG, or PDF.")
        if f.size > MAX_DOC_BYTES:
            raise VerificationDocInvalid(detail="Each document must be ≤ 5 MB.")
        key = f"verification/{user.id}/{request_id}/{uuid7()}.{ext}"
        media.store_private_file(key, f.read(), f.content_type)
        keys.append(key)
    return keys


@transaction.atomic
def submit_verification(
    *, user: User, kind: str, files: list, rc_number: str = ""
) -> VerificationRequest:
    if VerificationRequest.objects.filter(
        user=user, kind=kind, state=VerificationState.PENDING
    ).exists():
        raise VerificationPending()

    if kind == VerificationKind.BUSINESS and not rc_number:
        raise VerificationDocInvalid(detail="An RC number is required for business verification.")

    request = VerificationRequest.objects.create(
        user=user,
        kind=kind,
        rc_number=rc_number,
        state=VerificationState.PENDING,
        doc_keys=[],
    )
    request.doc_keys = _validate_and_store(user, request.id, files)
    request.save(update_fields=["doc_keys", "updated_at"])
    return request


def _target_level(kind: str) -> str:
    return ACCOUNT_LEVEL_TARGETS[kind]


@transaction.atomic
def approve(request: VerificationRequest, *, reviewer: User) -> VerificationRequest:
    request.state = VerificationState.APPROVED
    request.reviewer = reviewer
    request.reason = ""
    request.decided_at = timezone.now()
    request.save(update_fields=["state", "reviewer", "reason", "decided_at", "updated_at"])

    user = request.user
    target = _target_level(request.kind)
    # Never downgrade: a Business-Verified user approving an identity doc stays
    # Business Verified.
    if target == str(AccountLevel.BUSINESS_VERIFIED) or not user.is_verified:
        user.account_level = target
        user.save(update_fields=["account_level", "updated_at"])

    transaction.on_commit(
        lambda: send_verification_email.enqueue(user.email, request.kind, True, "")
    )
    return request


@transaction.atomic
def reject(request: VerificationRequest, *, reviewer: User, reason: str) -> VerificationRequest:
    if not reason or not reason.strip():
        raise VerificationDocInvalid(detail="A rejection reason is required.")
    request.state = VerificationState.REJECTED
    request.reviewer = reviewer
    request.reason = reason.strip()
    request.decided_at = timezone.now()
    request.save(update_fields=["state", "reviewer", "reason", "decided_at", "updated_at"])

    user = request.user
    transaction.on_commit(
        lambda: send_verification_email.enqueue(user.email, request.kind, False, reason)
    )
    return request


def current_status(user: User) -> dict:
    requests = list(VerificationRequest.objects.filter(user=user).order_by("-created_at"))
    return {"account_level": user.account_level, "requests": requests}
