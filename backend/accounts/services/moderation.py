"""Ops user moderation (wave-6 §6.7): suspend / reactivate / strike adjust.

Suspension is a cascade asserted across waves 1/2/4: it blocks login
(``services.login`` raises ``AccountSuspended``), hides the supplier's listings
from search and 404s their storefront (both filter ``suspended_at``), and here
freezes their not-yet-paid payouts. Bumping ``token_version`` kills live
sessions immediately. Reactivation lifts the suspension but leaves payouts
frozen — Ops unfreezes them deliberately from the payout queue.
"""

from __future__ import annotations

import structlog
from django.db import transaction
from django.utils import timezone

from accounts.models import User

logger = structlog.get_logger("ops.moderation")


@transaction.atomic
def suspend_user(user: User, *, reason: str) -> User:
    user.suspended_at = timezone.now()
    user.suspended_reason = reason
    user.token_version = user.token_version + 1  # kill outstanding sessions
    user.save(update_fields=["suspended_at", "suspended_reason", "token_version", "updated_at"])

    # Freeze the supplier's open payouts (no-op for a pure hirer).
    from payments import services as payment_services

    frozen = payment_services.freeze_supplier_payouts(user, reason="account_suspended")
    logger.info("ops.user_suspended", user_id=str(user.pk), payouts_frozen=frozen)
    return user


@transaction.atomic
def reactivate_user(user: User) -> User:
    user.suspended_at = None
    user.suspended_reason = ""
    user.save(update_fields=["suspended_at", "suspended_reason", "updated_at"])
    logger.info("ops.user_reactivated", user_id=str(user.pk))
    return user


@transaction.atomic
def adjust_strikes(user: User, *, delta: int, reason: str) -> int:
    """Manually adjust a supplier's strike count (clamped at 0). Returns the new count."""
    profile = getattr(user, "supplier_profile", None)
    if profile is None:
        raise ValueError("User has no supplier profile to strike.")
    profile.strike_count = max(0, profile.strike_count + delta)
    profile.save(update_fields=["strike_count", "updated_at"])
    logger.info(
        "ops.strike_adjusted",
        user_id=str(user.pk),
        delta=delta,
        new_count=profile.strike_count,
        reason=reason,
    )
    return profile.strike_count
