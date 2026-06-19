"""Payment services — checkout init, webhook ingest, verify-before-transition.

Business logic for the collect-only money flow (D-017). Webhooks are
load-bearing: the only path that marks a hire paid is a verified
``collection.succeeded`` event — never a client redirect. Idempotency is layered
(envelope dedup → ``processed_at`` guard → the state machine's transition guard)
so duplicate/replayed deliveries are safe.
"""

from __future__ import annotations

import structlog
from django.db import IntegrityError, transaction
from django.utils import timezone

from hires import state
from hires.enums import ActorKind
from hires.models import Hire

from . import bachs, refunds
from .enums import PaymentState, RefundState
from .errors import PaymentAttemptsExceeded
from .models import Payment, PaymentEvent, Refund

logger = structlog.get_logger(__name__)

MAX_ATTEMPTS = 3
COLLECTION_SUCCEEDED = "collection.succeeded"
STRIKE_SUSPENSION_THRESHOLD = 3


def initialize_payment(hire: Hire) -> Payment:
    """Open a Bachs checkout for a freshly-accepted hire (≤3 attempts/window)."""
    attempt = Payment.objects.filter(hire=hire).count() + 1
    if attempt > MAX_ATTEMPTS:
        raise PaymentAttemptsExceeded()
    reference = f"THR-{hire.id.hex[:12]}-{attempt}"
    checkout = bachs.create_checkout(
        reference=reference, amount_kobo=hire.hire_value, hire_id=str(hire.id)
    )
    return Payment.objects.create(
        hire=hire,
        reference=reference,
        amount=hire.hire_value,
        attempt=attempt,
        authorization_url=checkout["authorization_url"],
        charge_id=checkout.get("charge_id", ""),
        state=PaymentState.INITIATED,
    )


def latest_payment(hire: Hire) -> Payment | None:
    return hire.payments.order_by("-attempt").first()


def record_event(*, event_id: str, event_type: str, payload: dict) -> bool:
    """Persist a webhook envelope; return False if already seen (dedup).

    The insert is savepoint-wrapped so a duplicate's IntegrityError rolls back
    only the savepoint, leaving the surrounding transaction usable.
    """
    try:
        with transaction.atomic():
            PaymentEvent.objects.create(event_id=event_id, event_type=event_type, payload=payload)
        return True
    except IntegrityError:
        return False


def _resolve_payment(payload: dict) -> Payment | None:
    data = payload.get("data", {})
    reference = data.get("reference")
    if not reference:
        return None
    return Payment.objects.select_related("hire").filter(reference=reference).first()


def process_collection_event(event_id: str) -> None:
    """Verify the charge with Bachs, then confirm the hire (verify-before-transition).

    Idempotent: a processed event short-circuits, an unverifiable charge does not
    transition, and a hire that's already past Accepted is skipped by the state
    machine's own guard.
    """
    event = PaymentEvent.objects.filter(event_id=event_id).first()
    if event is None or event.processed_at is not None:
        return
    if event.event_type != COLLECTION_SUCCEEDED:
        _mark_processed(event)
        return

    payment = _resolve_payment(event.payload)
    if payment is None:
        logger.warning("payments.event_no_payment", event_id=event_id)
        _mark_processed(event)
        return

    charge_id = event.payload.get("data", {}).get("charge_id") or payment.charge_id
    charge = bachs.verify_charge(charge_id)
    verified = (
        charge.ok
        and charge.status == "SUCCEEDED"
        and charge.amount_kobo == payment.amount
        and charge.currency == bachs.CURRENCY
    )
    if not verified:
        # Don't transition on an unverifiable charge; leave unprocessed so a
        # later (genuine) delivery can still succeed. Client redirects are never
        # trusted — only this verified path marks a hire paid.
        logger.warning("payments.charge_unverified", event_id=event_id, reference=payment.reference)
        return

    with transaction.atomic():
        hire = Hire.objects.select_for_update().get(pk=payment.hire_id)
        try:
            state.apply(hire, "pay", actor_kind=str(ActorKind.SYSTEM), reference=payment.reference)
        except Exception:
            # Already Confirmed (replay) or no longer Accepted — idempotent skip.
            logger.info("payments.already_settled", reference=payment.reference)
            _mark_processed(event)
            return
        payment.state = PaymentState.SUCCESS
        payment.charge_id = charge_id
        payment.paid_at = timezone.now()
        payment.save(update_fields=["state", "charge_id", "paid_at", "updated_at"])
        _mark_processed(event)


def _mark_processed(event: PaymentEvent) -> None:
    event.processed_at = timezone.now()
    event.save(update_fields=["processed_at", "updated_at"])


# --- refunds (FSD §7.6) -----------------------------------------------------
def successful_payment(hire: Hire) -> Payment | None:
    return hire.payments.filter(state=PaymentState.SUCCESS).order_by("-paid_at").first()


@transaction.atomic
def issue_refund(hire: Hire, *, cancelled_by: str, reason: str = "") -> Refund:
    """Refund a cancelled paid hire per §7.6, recording a strike if the supplier
    cancelled. The withheld-day supplier payout (D-015) is created in slice 4F."""
    plan = refunds.compute_refund_plan(hire, cancelled_by=cancelled_by)
    payment = successful_payment(hire)
    charge_id = payment.charge_id if payment else ""

    result = bachs.create_refund(
        charge_id=charge_id, amount_kobo=plan.amount, reason=reason or plan.kind
    )
    refund = Refund.objects.create(
        hire=hire,
        amount=plan.amount,
        state=RefundState.COMPLETED if result["ok"] else RefundState.PENDING,
        provider_ref=result.get("provider_ref", ""),
        reason=plan.kind,
    )
    if not result["ok"]:
        # Keyless dev or a provider failure — leave it PENDING for Ops to retry.
        logger.warning("payments.refund_unsettled", hire=str(hire.id), amount=plan.amount)

    if plan.strike:
        _record_supplier_strike(hire)
    return refund


def _record_supplier_strike(hire: Hire) -> None:
    from suppliers.models import SupplierProfile

    profile = SupplierProfile.objects.select_for_update().filter(user_id=hire.supplier_id).first()
    if profile is None:
        return
    profile.strike_count += 1
    profile.save(update_fields=["strike_count", "updated_at"])
    if profile.strike_count >= STRIKE_SUSPENSION_THRESHOLD:
        # Ops surfaces the suspension review in Wave 6; flag it loudly now.
        logger.warning("payments.supplier_suspension_review", supplier=str(hire.supplier_id))


def retained(hire: Hire) -> int:
    """``collected − refunded − paid_out`` — the kobo Terminal currently holds.

    ``collected`` = successful payments, ``refunded`` = refunds (completed or
    pending-but-owed), ``paid_out`` = paid supplier payouts (Wave 4F; 0 until
    then). Money is conserved when this equals the fee Terminal should keep — the
    service fee at completion, or the processing fee on a late cancellation once
    the withheld-day payout settles (4F). Tests assert the books balance.
    """
    collected = sum(p.amount for p in hire.payments.filter(state=PaymentState.SUCCESS))
    refunded = sum(
        r.amount
        for r in hire.refunds.filter(state__in=[RefundState.COMPLETED, RefundState.PENDING])
    )
    paid_out = 0  # Payout model lands in 4F
    return collected - refunded - paid_out
