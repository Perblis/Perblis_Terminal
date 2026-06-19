"""Hire notifications — the FSD §9 matrix (email side), D-014-safe.

A thin dispatcher invoked post-commit from the state machine for every
transition, plus money-event helpers called from the payments services. Email
is the transport here; in-app badges accrue on the realtime surface (Wave 5).

D-014 is load-bearing: **hirer-facing copy never names the service fee or
payout** — the hirer's receipt shows only the total they paid. Supplier copy may
carry the full breakdown. Supplier email preferences (``SupplierProfile``) are
honoured; delivery is best-effort and never raises into the caller.
"""

from __future__ import annotations

import structlog

from accounts.integrations import email as email_integration
from core.money import display

from .enums import HireStatus
from .models import Hire

logger = structlog.get_logger(__name__)


def _email(to: str, subject: str, body: str) -> None:
    try:
        email_integration.send_email(to=to, subject=subject, body=body)
    except Exception:  # delivery is best-effort; a transition must not fail on it
        logger.exception("notify.email_failed", to=to, subject=subject)


def _supplier_pref(hire: Hire, attr: str) -> bool:
    profile = getattr(hire.supplier, "supplier_profile", None)
    return bool(getattr(profile, attr, True)) if profile is not None else True


def _notify_requested(hire: Hire) -> None:
    if _supplier_pref(hire, "notif_hire_requests"):
        _email(
            hire.supplier.email,
            "New hire request on Terminal",
            f"You have a new request for {hire.listing.title} "
            f"({hire.start_date} → {hire.end_date}). Review it in your portal.",
        )


def _notify_accepted(hire: Hire) -> None:
    # Hirer pays the total only — never the fee (D-014).
    _email(
        hire.hirer.email,
        "Your hire was accepted — complete payment",
        f"Your request for {hire.listing.title} was accepted. "
        f"Pay {display(hire.hire_value)} within 4 hours to confirm the hire.",
    )


def _notify_confirmed(hire: Hire) -> None:
    # Hirer receipt: total only (D-014).
    _email(
        hire.hirer.email,
        "Payment received — your hire is confirmed",
        f"We've received {display(hire.hire_value)} for {hire.listing.title}. "
        f"Your hire is confirmed for {hire.start_date} → {hire.end_date}.",
    )
    # Supplier: full breakdown is allowed.
    _email(
        hire.supplier.email,
        "A hire was confirmed",
        f"{hire.listing.title} is confirmed ({hire.start_date} → {hire.end_date}). "
        f"Hire value {display(hire.hire_value)}; service fee {display(hire.service_fee)}; "
        f"you receive {display(hire.payout_amount)}.",
    )


def _notify_declined(hire: Hire) -> None:
    _email(
        hire.hirer.email,
        "Your hire request was declined",
        f"Your request for {hire.listing.title} was declined. {hire.decline_reason}".strip(),
    )


def _notify_cancelled(hire: Hire) -> None:
    note = f" Reason: {hire.cancel_reason}." if hire.cancel_reason else ""
    for addr in {hire.hirer.email, hire.supplier.email}:
        _email(
            addr, "A hire was cancelled", f"The hire for {hire.listing.title} was cancelled.{note}"
        )


def _notify_expired(hire: Hire) -> None:
    _email(
        hire.hirer.email,
        "Your hire request expired",
        f"Your request for {hire.listing.title} expired without a response.",
    )


def _notify_completed(hire: Hire) -> None:
    _email(
        hire.hirer.email, "Your hire is complete", f"The hire for {hire.listing.title} is complete."
    )
    if _supplier_pref(hire, "notif_payouts"):
        _email(
            hire.supplier.email,
            "Hire complete — payout queued",
            f"{hire.listing.title} is complete. A payout of {display(hire.payout_amount)} is queued.",
        )


_HANDLERS = {
    str(HireStatus.REQUESTED): _notify_requested,
    str(HireStatus.ACCEPTED): _notify_accepted,
    str(HireStatus.CONFIRMED): _notify_confirmed,
    str(HireStatus.DECLINED): _notify_declined,
    str(HireStatus.CANCELLED): _notify_cancelled,
    str(HireStatus.EXPIRED): _notify_expired,
    str(HireStatus.COMPLETED): _notify_completed,
}


def dispatch(hire: Hire, *, to_status: str) -> None:
    """Fire the matrix email(s) for a hire that just entered ``to_status``."""
    handler = _HANDLERS.get(to_status)
    if handler is not None:
        handler(hire)


def notify_supplier_nudge(hire: Hire) -> None:
    """Supplier nudge ~20h into an unanswered request (FSD §9)."""
    if _supplier_pref(hire, "notif_hire_requests"):
        _email(
            hire.supplier.email,
            "A hire request is still waiting",
            f"Your request for {hire.listing.title} expires soon — respond before it lapses.",
        )


def notify_payment_warning(hire: Hire) -> None:
    """Hirer 60-minute payment-window warning (FSD §9). Total only (D-014)."""
    _email(
        hire.hirer.email,
        "Your payment window is closing",
        f"Pay {display(hire.hire_value)} for {hire.listing.title} within the hour, "
        "or the hire will be cancelled.",
    )


def notify_supplier_strike(hire: Hire, *, strike_count: int) -> None:
    """Supplier-cancellation strike email (FSD §9 last row)."""
    suffix = " A third strike triggers a suspension review." if strike_count >= 3 else ""
    _email(
        hire.supplier.email,
        "A strike was recorded on your account",
        f"Cancelling a confirmed hire recorded a strike (now {strike_count}).{suffix}",
    )
