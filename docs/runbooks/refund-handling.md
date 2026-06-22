# Runbook — Refund handling

**Audience:** Founder / Ops · **Surface:** Ops Console → Hires (+ Payments → Refunds)

Refunds are **never manual ledger edits**. They are produced by the cancellation /
dispute services per FSD §7.6 and recorded as `Refund` rows. Financial fields on a
hire are locked at acceptance — corrections are new Refund/Payout records, not edits.

## When refunds happen automatically

- **Hirer cancels > 72h before start** → full refund.
- **Hirer cancels ≤ 72h before start** → refund minus one day + processing fee; the
  withheld day becomes a supplier payout (D-015).
- **Supplier cancels a paid hire** → full refund to the hirer + a supplier strike.
- **Dispute resolved → Cancelled** → refund per the same §7.6 rules.

All of these run through `cancel_hire` / `resolve_dispute` (the state machine) — use
the Ops Console actions below, not the database.

## Steps (Ops-initiated cancellation / dispute refund)

1. Ops Console → *Hires* → open the hire. Review the **event timeline**, the
   linked **payment/refund/payout** inlines, and the **money invariant** line.
2. For a dispute: use **"Resolve dispute → Cancelled"** (reason required). For a
   non-terminal hire: **"Admin cancel"** (reason required). The §7.6 refund is
   issued automatically post-commit.
3. Confirm a `Refund` row appears (Payments → Refunds) with the expected amount and
   `state` progressing to `completed`.

## Verification

- The hire's money-invariant line nets to zero once payouts/refunds settle (not red).
- The hirer's refund matches the §7.6 expectation for the timing/role.
- Every step is in the hire's event timeline (append-only) + Django LogEntry.

## Escalation

If a refund `state=failed` (provider error), retry from the provider dashboard and
record the outcome; do not fabricate a Refund row. Reconciliation (daily) will flag
any divergence between local refunds and the provider ledger.
