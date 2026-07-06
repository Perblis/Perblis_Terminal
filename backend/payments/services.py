"""Payment services — checkout init, webhook ingest, verify-before-transition.

Business logic for the collect-only money flow, provider-neutral via
``payments.gateway`` (Paystack by default, D-018). Webhooks are load-bearing:
the only path that marks a hire paid is a provider-verified success event —
never a client redirect. Idempotency is layered (envelope dedup → ``processed_at``
guard → the state machine's transition guard) so duplicate/replayed deliveries
are safe.
"""

from __future__ import annotations

import structlog
from django.db import IntegrityError, transaction
from django.utils import timezone

from hires import state
from hires.enums import ActorKind, HireStatus
from hires.models import Hire

from . import gateway, refunds
from .enums import PaymentState, PayoutKind, PayoutState, RefundState
from .errors import PaymentAttemptsExceeded, PayoutAlreadyPaid, PayoutFrozen
from .models import Payment, PaymentEvent, Payout, Refund

logger = structlog.get_logger(__name__)

MAX_ATTEMPTS = 3
STRIKE_SUSPENSION_THRESHOLD = 3


def initialize_payment(hire: Hire) -> Payment:
    """Open a checkout for a freshly-accepted hire (≤3 attempts/window)."""
    hire = Hire.objects.select_related("hirer").get(pk=hire.pk)
    attempt = Payment.objects.filter(hire=hire).count() + 1
    if attempt > MAX_ATTEMPTS:
        raise PaymentAttemptsExceeded()
    reference = f"THR-{hire.id.hex[:12]}-{attempt}"
    checkout = gateway.create_checkout(
        reference=reference,
        amount_kobo=hire.hire_value,
        hire_id=str(hire.id),
        customer_email=hire.hirer.email,
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
    """Verify the charge with the provider, then confirm the hire (verify-before-transition).

    Idempotent: a processed event short-circuits, an unverifiable charge does not
    transition, and a hire that's already past Accepted is skipped by the state
    machine's own guard.
    """
    event = PaymentEvent.objects.filter(event_id=event_id).first()
    if event is None or event.processed_at is not None:
        return
    parsed = gateway.parse_webhook(event.payload)
    if not parsed.succeeded:
        _mark_processed(event)
        return

    payment = _resolve_payment(event.payload)
    if payment is None:
        logger.warning("payments.event_no_payment", event_id=event_id)
        _mark_processed(event)
        return

    charge_id = parsed.charge_id or payment.charge_id
    charge = gateway.verify_charge(reference=payment.reference, charge_id=charge_id)
    verified = (
        charge.ok
        and charge.succeeded
        and charge.amount_kobo == payment.amount
        and charge.currency == gateway.CURRENCY
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

    result = gateway.create_refund(
        reference=payment.reference if payment else "",
        charge_id=charge_id,
        amount_kobo=plan.amount,
        reason=reason or plan.kind,
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

    if plan.withheld_day > 0:
        # D-015: the withheld day on a late hirer cancellation pays the supplier.
        Payout.objects.get_or_create(
            hire=hire,
            kind=PayoutKind.WITHHELD_DAY,
            defaults={
                "supplier_id": hire.supplier_id,
                "amount": plan.withheld_day,
                "state": PayoutState.DUE,
            },
        )
    if plan.strike:
        _record_supplier_strike(hire)
    return refund


# --- payouts (FSD §3.2, D-015) ----------------------------------------------
@transaction.atomic
def create_completion_payout(hire: Hire) -> Payout | None:
    """On completion, a supplier payout enters the Ops queue at ``due``.

    Idempotent (one completion payout per hire). A hire still In Dispute yields a
    frozen payout instead — the freeze lifts when Ops resolves to Completed.
    """
    if hire.status not in (HireStatus.COMPLETED, HireStatus.IN_DISPUTE):
        return None
    frozen = hire.status == HireStatus.IN_DISPUTE
    payout, created = Payout.objects.get_or_create(
        hire=hire,
        kind=PayoutKind.COMPLETION,
        defaults={
            "supplier_id": hire.supplier_id,
            "amount": hire.payout_amount,
            "state": PayoutState.FROZEN if frozen else PayoutState.DUE,
            "frozen_reason": "in_dispute" if frozen else "",
        },
    )
    if not created and not frozen and payout.state == PayoutState.FROZEN:
        payout.state = PayoutState.DUE
        payout.frozen_reason = ""
        payout.save(update_fields=["state", "frozen_reason", "updated_at"])
    return payout


@transaction.atomic
def freeze_payouts(hire: Hire, *, reason: str = "in_dispute") -> int:
    """Freeze any not-yet-paid payouts for a hire (dispute raised)."""
    return hire.payouts.filter(state__in=[PayoutState.PENDING, PayoutState.DUE]).update(
        state=PayoutState.FROZEN, frozen_reason=reason
    )


@transaction.atomic
def freeze_supplier_payouts(supplier, *, reason: str = "account_suspended") -> int:
    """Freeze all of a supplier's not-yet-paid payouts (suspension cascade)."""
    return Payout.objects.filter(
        supplier=supplier, state__in=[PayoutState.PENDING, PayoutState.DUE]
    ).update(state=PayoutState.FROZEN, frozen_reason=reason)


@transaction.atomic
def mark_payout_paid(payout: Payout, *, reference: str) -> Payout:
    """Ops records a completed bank transfer; the supplier is emailed (FSD §9).

    A frozen payout must be unfrozen first — paying out on a live dispute is a
    bug, not a workflow.
    """
    if payout.state == PayoutState.FROZEN:
        raise PayoutFrozen()
    payout.state = PayoutState.PAID
    payout.paid_ref = reference
    payout.paid_at = timezone.now()
    payout.save(update_fields=["state", "paid_ref", "paid_at", "updated_at"])

    # Notify post-commit (lazy import avoids the tasks<->services import cycle).
    from payments import tasks

    transaction.on_commit(lambda: tasks.notify_payout_paid.enqueue(str(payout.id)))
    return payout


@transaction.atomic
def freeze_payout(payout: Payout, *, reason: str) -> Payout:
    """Freeze a single payout (Ops, e.g. pending investigation)."""
    if payout.state == PayoutState.PAID:
        raise PayoutAlreadyPaid()
    payout.state = PayoutState.FROZEN
    payout.frozen_reason = reason
    payout.save(update_fields=["state", "frozen_reason", "updated_at"])
    return payout


@transaction.atomic
def unfreeze_payout(payout: Payout) -> Payout:
    """Lift a freeze, returning the payout to the ``due`` queue."""
    if payout.state != PayoutState.FROZEN:
        return payout
    payout.state = PayoutState.DUE
    payout.frozen_reason = ""
    payout.save(update_fields=["state", "frozen_reason", "updated_at"])
    return payout


def _record_supplier_strike(hire: Hire) -> None:
    from suppliers.models import SupplierProfile

    profile = SupplierProfile.objects.select_for_update().filter(user_id=hire.supplier_id).first()
    if profile is None:
        return
    profile.strike_count += 1
    profile.save(update_fields=["strike_count", "updated_at"])
    from hires import notifications

    notifications.notify_supplier_strike(hire, strike_count=profile.strike_count)
    if profile.strike_count >= STRIKE_SUSPENSION_THRESHOLD:
        # Ops surfaces the suspension review in Wave 6; flag it loudly now.
        logger.warning("payments.supplier_suspension_review", supplier=str(hire.supplier_id))


def reconcile(ledger: list[dict]) -> dict:
    """Compare the provider ledger against local successful payments (TSD §3.6).

    ``ledger`` is the gateway-normalised list of ``{reference, amount_kobo,
    succeeded}``. Any divergence — a local success the ledger doesn't confirm, an
    amount mismatch, or a succeeded charge we never recorded — is a mismatch.
    Mismatches are logged at error level (Sentry picks them up) and raised to
    Ops. Zero-mismatch is a launch criterion.
    """
    local = {p.reference: p for p in Payment.objects.filter(state=PaymentState.SUCCESS)}
    by_ref = {row["reference"]: row for row in ledger}
    mismatches: list[dict] = []

    for ref, payment in local.items():
        row = by_ref.get(ref)
        if row is None:
            mismatches.append({"reference": ref, "issue": "missing_in_ledger"})
        elif not row.get("succeeded"):
            mismatches.append({"reference": ref, "issue": "status_mismatch"})
        elif int(row.get("amount_kobo", 0)) != payment.amount:
            mismatches.append({"reference": ref, "issue": "amount_mismatch"})

    for ref, row in by_ref.items():
        if row.get("succeeded") and ref not in local:
            mismatches.append({"reference": ref, "issue": "missing_locally"})

    if mismatches:
        logger.error("payments.reconciliation_mismatch", count=len(mismatches), items=mismatches)
    return {"checked": len(local), "mismatches": mismatches}


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
    paid_out = sum(p.amount for p in hire.payouts.filter(state=PayoutState.PAID))
    return collected - refunded - paid_out


# --- supplier payouts surface (Wave 7 P2/F11) --------------------------------
def list_payouts(*, supplier):
    """The supplier's payouts, newest first (cursor-paginated by the view)."""
    return (
        Payout.objects.filter(supplier=supplier)
        .select_related("hire__listing")
        .order_by("-created_at")
    )


def payout_summary(*, supplier) -> dict:
    """The P2 payout strip + "Earned this month" figures, server-computed.

    "Earned" attributes a payout to the month its hire settled (``created_at``),
    regardless of when the founder pays it out; a frozen payout stays earned but
    is excluded from the queue (it shows "on hold - dispute" instead, F11).
    """
    import datetime as dt

    from django.db.models import Sum

    from core.money import display

    def _total(qs) -> int:
        return qs.aggregate(t=Sum("amount"))["t"] or 0

    qs = Payout.objects.filter(supplier=supplier)
    queued = _total(qs.filter(state__in=[PayoutState.PENDING, PayoutState.DUE]))
    frozen = _total(qs.filter(state=PayoutState.FROZEN))

    now = timezone.localtime()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (month_start - dt.timedelta(days=1)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    earned_this_month = _total(qs.filter(created_at__gte=month_start))
    earned_prev_month = _total(
        qs.filter(created_at__gte=prev_month_start, created_at__lt=month_start)
    )

    last_paid = qs.filter(state=PayoutState.PAID).order_by("-paid_at").first()
    return {
        "queued_total": queued,
        "queued_total_display": display(queued),
        "frozen_total": frozen,
        "frozen_total_display": display(frozen),
        "earned_this_month": earned_this_month,
        "earned_this_month_display": display(earned_this_month),
        "earned_prev_month": earned_prev_month,
        "earned_prev_month_display": display(earned_prev_month),
        "last_paid": (
            {
                "amount": last_paid.amount,
                "amount_display": display(last_paid.amount),
                "paid_ref": last_paid.paid_ref,
                "paid_at": last_paid.paid_at,
            }
            if last_paid
            else None
        ),
    }
