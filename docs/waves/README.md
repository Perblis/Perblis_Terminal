# Build Waves — Index & Gating Rules

Terminal is built in **gated waves**. Each wave has its own file in this directory: the complete build brief a coding agent needs to execute that wave without re-deriving scope.

## The rules (binding — see design.md §7)

1. **No wave starts without explicit founder approval.** Finishing a wave does not authorize the next one.
2. A wave is **done** when its exit criterion is demonstrated, its mandatory tests are green, and its OpenAPI contracts (if any) are regenerated and committed.
3. Contracts frozen at the end of a wave are **breaking-change-locked** — later waves consume them; changing one requires founder sign-off.
4. If a wave surfaces a spec conflict or gap: **stop, surface it** for a DECISIONS.md entry. Never improvise around it.
5. Every PR inside a wave satisfies the Definition of Done (design.md §6).

## Backend waves (this batch)

| Wave | File | Deliverable | Status |
|---|---|---|---|
| 0 | [wave-0.md](wave-0.md) | Monorepo, compose, Django skeleton, tokens package, CI, prod deploy | ✅ Backend done & deployed · ⏸ Supplier-Portal Cloudflare deploy still pending |
| 1 | [wave-1.md](wave-1.md) | Accounts: register / OTP / JWT / reset · verification requests + queue | ✅ Done & merged (PRs #7–#13; incl. independent email+phone OTP) |
| 2 | [wave-2.md](wave-2.md) | Supply: supplier profiles, yards, spec templates, listings CRUD + publish | 🟡 Approved & starting |
| 3 | [wave-3.md](wave-3.md) | Search: map endpoint (yard aggregation), list, filters | ⏸ Gated on Wave 2 |
| 4 | [wave-4.md](wave-4.md) | Hires + money: state machine, availability, fees, Paystack, sweeps, payouts | ⏸ Gated on Wave 3 |
| 5 | [wave-5.md](wave-5.md) | Messaging: conversations, masking, Ably + polling fallback | ⏸ Gated on Wave 4 |
| 6 | [wave-6.md](wave-6.md) | Ops Console: queues, dashboard, dispute actions, digests | ⏸ Gated on Wave 5 |

## Frontend & launch waves

| Wave | File | Deliverable | Status |
|---|---|---|---|
| 7 | [wave-7.md](wave-7.md) | Supplier Portal complete (FSD §10.2, screens `ux/03` P1–P12) | ⏸ Gated on Wave 4 contract freeze (Messages slice needs Wave 5) |
| 8 | [wave-8.md](wave-8.md) | Hirer app complete (FSD §10.1, screens `ux/02` S1–S17) | ⏸ Gated on Wave 4 contract freeze (Messages slice needs Wave 5) |
| 9 | [wave-9.md](wave-9.md) | Hardening: journeys verbatim, load, security, runbooks, beta, launch gate | ⏸ Gated on Waves 0–8 |

Waves 7 and 8 may interleave with Waves 5–6 once Wave 4's OpenAPI contracts are frozen (TSD §10).

**Numbering note for Waves 7–8:** the `ux/` docs cite pre-v2.1 FSD numbering — read their "§6.3 / §6.6 / §8.1 / §8.2" as v2.1 **§7.3 / §7.6 / §10.1 / §10.2**.

## Reading order for any wave

`design.md` → this README → the wave file → the FSD/TSD sections it cites → relevant `docs/v2/` companion docs.

## Status legend

⏸ gated · 🟡 approved & in progress · ✅ exit criterion demonstrated, founder signed off
