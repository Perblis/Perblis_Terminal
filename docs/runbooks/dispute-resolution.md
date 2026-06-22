# Runbook — Dispute resolution

**Audience:** Founder / Ops · **Surface:** Ops Console → Hires

A hire goes `In Dispute` when either party raises a dispute (On Hire, or ≤72h after
end). Raising a dispute **freezes the payout** until Ops resolves it. Resolution is
either → **Completed** or → **Cancelled** (FSD §7.3 row 7), always through the state
machine with an append-only event + a LogEntry.

## Investigate

1. Ops Console → *Hires* → filter *Status = In Dispute* → open the hire.
2. Read the **event timeline**, both parties, the financials, the linked
   payment/refund/payout records, and the **read-only conversation** (Ops sees the
   original, unmasked message bodies for dispute context, FSD §8).
3. Decide based on evidence (handover photos/readings, messages, dates).

## Resolve

- **→ Completed** ("Resolve dispute → Completed"): the supplier fulfilled. Lifts the
  payout freeze and queues the completion payout at `due`. Reason required.
- **→ Cancelled** ("Resolve dispute → Cancelled"): the hirer is owed. Issues the
  §7.6 refund (see refund-handling runbook). Reason required.

Both actions are bulk-safe (operate on the selected `in_dispute` hires only) and
write a HireEvent + LogEntry.

## Adjustments

Corrections are **new Refund / Payout records**, never edits to locked financial
fields. If a resolution needs a partial adjustment beyond the standard §7.6 math,
record it as an explicit Refund/Payout and note the reason — then re-check the
hire's **money invariant** line (must net to zero once settled; red = imbalance).

## Verification

- Hire status is `completed` or `cancelled`; payout is `due` (completed) or the
  refund is recorded (cancelled).
- Money-invariant line is not red after settlement.
- The timeline shows the `ops` actor on the resolving event.
