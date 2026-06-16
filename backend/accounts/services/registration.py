"""User registration.

Creates the account (Hirer by default, Basic level), captures NDPR consent,
issues the first phone OTP, and dispatches a welcome email. All side-effecting
writes live here, not in the view.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from accounts.services.otp import issue_otp
from accounts.tasks import send_welcome_email


@transaction.atomic
def register_user(
    *,
    full_name: str,
    email: str,
    phone: str,
    password: str,
) -> User:
    now = timezone.now()
    user = User.objects.create_user(
        email=email,
        phone=phone,
        password=password,
        full_name=full_name,
        is_hirer=True,
        is_supplier=False,
        tos_accepted_at=now,
        privacy_accepted_at=now,
    )
    # Issue OTP + welcome email after the row commits so the worker never races
    # an uncommitted user.
    transaction.on_commit(lambda: issue_otp(user))
    transaction.on_commit(lambda: send_welcome_email.enqueue(user.email, user.full_name))
    return user
