# Runbook — Weekly payout batch

**Audience:** Founder / Ops · **Cadence:** weekly (Fridays) · **Surface:** Ops Console → Payments → Payouts

Terminal collects hire payments and pays suppliers manually each week (collect-only,
D-018). Payouts enter the queue at `due` on hire completion (FSD §3.2).

## Steps

1. **Open the payout queue.** Ops Console → *Payouts*. The list is **due-first**;
   filter by *State = Due* and, if batching by week, by the *Created* date filter.
2. **Review each due payout.** Open the row to see the supplier's **bank details**
   (bank name · full account number · account name — decrypted on this view only)
   and the linked hire. Cross-check the amount against the hire.
3. **Compute the batch total.** Select the payouts you intend to pay and run the
   **"Sum selected (batch total)"** action — it reports the naira total to transfer.
4. **Make the bank transfers** out-of-band (your bank). Record each transfer's
   **bank reference**.
5. **Mark paid.** Select the paid payouts → **"Mark paid"** action → enter the bank
   reference. This sets the payout to `paid`, stores the reference + timestamp, and
   **emails the supplier** ("payout paid"). One reference per action run — group
   payouts that share a reference, or run the action per reference.

## Holds & exceptions

- **Frozen payouts** (dispute or suspension) cannot be marked paid — resolve the
  underlying issue first, then **Unfreeze** (returns it to `due`). Never pay a
  frozen payout.
- **Suspended supplier:** suspension auto-freezes their open payouts. Investigate
  before unfreezing.
- A payout shown red on the dashboard money-invariant means a completed hire's
  books don't balance after settlement — stop and reconcile before paying.

## Verification

- Each paid payout shows `state=paid`, a `paid_ref`, and a `paid_at`.
- The supplier receives the "payout paid" email.
- The dashboard *Payout liability* drops by the batch total.
