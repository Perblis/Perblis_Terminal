"""Background tasks for accounts (django-tasks, DB broker).

Services enqueue these so request handlers stay fast and side-effects retry
independently — mirroring core.tasks.heartbeat. In tests the immediate backend
runs them synchronously.
"""

from __future__ import annotations

from datetime import timedelta

import structlog
from django.db import transaction
from django.utils import timezone
from django_tasks import task

from accounts.integrations import email as email_integration
from accounts.integrations import sms as sms_integration

logger = structlog.get_logger(__name__)

# Recovery window before a soft-deleted account is purged (FSD §4.2).
SOFT_DELETE_RETENTION = timedelta(days=30)


@task()
def dispatch_otp_sms(phone: str, code: str) -> None:
    sms_integration.send_otp_sms(phone, code)


@task()
def send_welcome_email(to: str, full_name: str) -> None:
    email_integration.send_welcome_email(to=to, full_name=full_name)


@task()
def send_reset_email(to: str, reset_url: str) -> None:
    email_integration.send_password_reset_email(to=to, reset_url=reset_url)


@task()
def send_verification_email(to: str, kind: str, approved: bool, reason: str = "") -> None:
    email_integration.send_verification_outcome_email(
        to=to, kind=kind, approved=approved, reason=reason
    )


@task()
def purge_soft_deleted_accounts() -> int:
    """Scrub PII from accounts past the 30-day recovery window.

    Verification requests + their documents are retained (NDPR 5-year carve-out)
    and financial records (Wave 4) likewise — so we erase the account's
    identifying data and credentials rather than deleting the row. Idempotent:
    `purged_at` gates re-runs, so a double-run is a no-op.
    """
    from accounts.models import OtpCode, PasswordResetToken, User

    cutoff = timezone.now() - SOFT_DELETE_RETENTION
    due = User.objects.filter(
        deleted_at__isnull=False,
        deleted_at__lt=cutoff,
        purged_at__isnull=True,
    )

    count = 0
    for user in due:
        with transaction.atomic():
            # Drop transient credentials/codes — no retention need.
            OtpCode.objects.filter(user=user).delete()
            PasswordResetToken.objects.filter(user=user).delete()
            # Scrub PII; keep the (now-anonymous) row so retained verification
            # records keep their foreign key.
            user.email = f"purged+{user.id}@deleted.terminal.invalid"
            user.phone = f"+0000{str(user.id.int)[:10]}"
            user.full_name = ""
            user.set_unusable_password()
            user.tos_accepted_at = None
            user.privacy_accepted_at = None
            user.is_active = False
            user.token_version = user.token_version + 1
            user.purged_at = timezone.now()
            user.save()
            count += 1

    logger.info("accounts.purge_soft_deleted", purged=count)
    return count
