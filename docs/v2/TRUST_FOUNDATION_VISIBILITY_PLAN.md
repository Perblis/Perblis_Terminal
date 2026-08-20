# Visible Trust Foundation — implementation plan

Status: founder direction recorded in D-032; implementation not started  
Date: 2026-08-20  
Scope: make existing transaction mechanics understandable at the moments when a Hirer or Supplier decides whether to stay on Terminal

## 1. Outcome

Terminal already has a trust layer, but most of it appears after a user has committed or is expressed as disconnected status, refund, dispute and handover features. The implementation should answer two questions before money moves:

- **Hirer:** “What do I gain by paying through Terminal instead of dealing directly?”
- **Supplier:** “What do I gain by accepting and completing this through Terminal instead of moving to WhatsApp?”

The first release does not introduce a new financial promise. It packages the truth already implemented:

1. supplier identity documents are reviewed before the supplier can publish;
2. accepted dates and commercial terms are recorded and locked;
3. payment is confirmed through Paystack before the hire is Confirmed;
4. cancellation follows explicit rules and the Hirer sees a server-computed refund preview before cancelling;
5. messages, status changes and handovers create a timestamped transaction record;
6. on/off-hire photos and readings are private evidence for the parties and Ops;
7. a dispute can freeze the Supplier payout while Ops reviews the evidence.

The working user-facing heading is **“Why complete this hire through Terminal”**. It is descriptive, not a new badge or regulated-sounding product name. A shorter name can be selected during the copy gate, but “Terminal Protected”, “escrow”, “insured” and “guaranteed” are not approved.

## 2. Non-goals

- No escrow, insurance, damage guarantee, asset-condition guarantee or guaranteed dispute result.
- No change to Paystack collection, payout timing, refunds or the hire state machine.
- No new Hirer-side fee and no disclosure of `service_fee` or `payout_amount`.
- No claim that Business Verification proves asset ownership, condition or operating quality.
- No public star ratings or subjective reviews in this work.
- No contact-blocking arms race. Contact masking remains a pre-payment control; value after payment is the retention mechanism.
- No public “completed hires” claim while production demo transactions can be mistaken for real market history.
- No hourly-hire work; D-031 keeps that outside the launch MVP.

## 3. Claims matrix

Copy must be derived from this matrix. If a mechanism changes, the claim changes with it.

| Mechanism | Allowed claim | Claim to avoid |
|---|---|---|
| Identity verification | “Supplier identity documents reviewed” | “Terminal guarantees this supplier” |
| Business verification | “Business documents reviewed” only at Business Verified level | “All listings are business verified” |
| Listing tier | “Verified listing” / “Inspected listing” only from the actual tier | “Terminal inspected this asset” on Basic or Verified listings |
| Accepted terms | “Accepted dates and total are locked in your hire record” | “The price can never change” before acceptance |
| Payment | “Payment is confirmed through Paystack before the hire starts” | “Escrow”, “funds held in trust”, “payment guaranteed” |
| Cancellation | “Refund rules are shown before payment; your exact refund is shown before cancellation” | “Always fully refundable” |
| Dispute | “The Supplier payout is frozen while Terminal reviews the record” | “Your money is automatically returned” or “Terminal will rule in your favour” |
| Handover | “Photos and readings form part of the hire record” | “Asset condition guaranteed” |
| Contact unlock | “Contact details unlock after payment confirmation” | Presenting masking itself as protection |
| Reputation, later | “N paid hires completed through Terminal” from provenance-clean records only | Counts containing demo, seeded, unpaid or manually advanced hires |

“Secure checkout by Paystack” may remain where it describes Paystack transport and checkout. It must not be visually combined with copy that implies escrow or a Terminal payment guarantee.

## 4. Product anatomy

### 4.1 Compact trust summary

A reusable summary introduces the value without turning every screen into a policy page:

- eyebrow: `THROUGH TERMINAL`
- title: `Recorded terms. Confirmed payment. Documented handover.`
- one-line role-specific support copy;
- `See how it works` opens the detailed explainer.

The summary is a factual content component, not a badge. It must not compete visually with price, availability or the primary CTA.

### 4.2 Detailed explainer

The explainer presents a five-step transaction:

1. **Supplier reviewed** — state the actual account/listing verification level.
2. **Terms recorded** — accepted dates and total lock into the hire record.
3. **Payment confirmed** — Paystack confirmation creates the Confirmed hire.
4. **Handover documented** — photos, readings and both-party confirmation.
5. **Issues reviewed** — disputes freeze the Supplier payout while Ops reviews the record.

Each line links to the relevant policy or action where one exists. The explainer must include a plain limitation:

> Terminal records and administers the hire. It does not own, operate or insure the asset.

### 4.3 Status-aware proof

After a request is created, generic promises should become completed facts:

- Requested: `Request and estimated total recorded`
- Accepted: `Terms locked · waiting for Paystack-confirmed payment`
- Confirmed: `Payment confirmed · contact details unlocked`
- On Hire: `On-hire record available` or `On-hire handover still needed`
- Completed: `Hire completed through Terminal`
- In Dispute: `Supplier payout frozen while the hire record is reviewed`

This proof must be computed from existing hire status, events and handover records. Clients must not invent a state.

## 5. Delivery slices

Each slice is independently releasable and must satisfy the repository Definition of Done. D-032 approves the direction; executing these slices still requires a founder build go.

### T0 — Claims and content gate

**Purpose:** settle exact truthful copy before UI implementation.

Changes:

- Add the claims matrix and final Hirer/Supplier copy to `docs/v2/design-system/09_Content_Microcopy.md`.
- Amend `docs/v2/ux/02_Hirer_App_Screens.md` for S6, S7, S8, S10 and S15.
- Amend `docs/v2/ux/03_Supplier_Portal_Screens.md` for request acceptance and hire detail.
- Confirm Terms of Service language matches collect-only payment, dispute handling and payout timing.
- Replace or approve existing ambiguous phrases such as `Funds are on hold` in the Hirer dispute state. The intended factual version is `The Supplier payout is frozen while our team reviews the hire record.`
- Choose whether the heading remains “Why complete this hire through Terminal”; do not choose a “protected” product name without claims review.

Exit checks:

- Every sentence maps to an implemented mechanism.
- Legal/product review records approved copy.
- No claim relies on Phase 2 deposits, insurance, inspections or reviews.

### T1 — Hirer decision and payment surfaces

**Purpose:** make on-platform value visible before and at payment.

Primary files:

- `mobile/components/trust/trust-summary.tsx` — new compact component.
- `mobile/components/trust/trust-explainer.tsx` — new accessible sheet/modal.
- `mobile/lib/trust-copy.ts` — role- and state-shaped pure copy mapping.
- `mobile/app/listing/[id].tsx`
- `mobile/app/hire-request/[listingId].tsx`
- `mobile/app/pay/[hireId].tsx`
- `mobile/app/hires/[id].tsx`
- `mobile/app/messages/[id].tsx` or the current conversation route.

Surface changes:

1. **Listing detail (S6):** place the compact summary after pricing and before policy/location detail. Verification text is derived from the actual account/listing level.
2. **Request review (S7):** add three concise facts beside the price manifest: no Hirer-side fee is added, accepted terms lock, and refund rules remain available before payment. Preserve the existing warning that the client figure is an estimate until the server creates the hire.
3. **Pay (S8):** place the detailed summary immediately after `LockedTerms` and before `Pay now`. State that Paystack confirmation—not the browser return—confirms the hire. Explain contact unlock and automatic date release on expiry.
4. **Payment success receipt:** add `Paid through Terminal`, the hire reference and a direct `View hire record` action. Keep the existing shareable receipt.
5. **Hire detail (S10):** add status-aware proof built from the existing hire and handover payloads. Correct dispute copy so it describes the Supplier payout freeze rather than suggesting escrow.
6. **Conversation (S15):** make the unlock line explain the benefit once, then get out of the way. Do not repeatedly market masking.

No backend or OpenAPI change is expected in T1.

Tests:

- Pure unit tests exhaust every hire status in `trust-copy.ts` with a `never` guard.
- Screen tests prove the summary appears on S6/S7/S8/S10 at the intended decision point.
- D-014 poison-payload tests prove `service_fee`, `payout_amount` and their labels cannot render.
- Verification tests prove Basic/Verified/Inspected/Business Verified claims do not overstate the payload.
- Static copy test rejects `escrow`, `insured`, `guaranteed`, `funds held` and unapproved `protected` wording in the trust components.
- Accessibility tests cover explainer title, close action, reading order and tap targets.

Manual acceptance:

- Record one Android walkthrough from listing → request review → accepted hire → checkout screen → payment success → hire record.
- Verify the trust summary supports rather than displaces price and the primary CTA on a small Android viewport.

### T2 — Supplier acceptance and fulfilment surfaces

**Purpose:** explain why the Supplier should keep acceptance, payment and handover on Terminal.

Primary files:

- `portal/components/trust/trust-summary.tsx` — Supplier-shaped equivalent.
- `portal/components/hires/respond-dialog.tsx`
- `portal/components/hires/locked-terms.tsx`
- `portal/app/(app)/hires/[id]/page.tsx`
- `portal/components/hires/handover-submit.tsx`
- `portal/components/hires/handover-evidence.tsx`

Surface changes:

1. **Accept dialog:** retain the full Supplier financial breakdown, then explain: acceptance locks the terms, the Hirer has four hours to pay, and the asset should not be released until the hire is Confirmed.
2. **Hire detail:** show state-shaped proof near `LockedTerms`: payment pending/confirmed, handover outstanding/recorded, payout due/frozen/paid.
3. **Handover:** keep evidence copy prominent and explain that counterparty confirmation strengthens the record without promising a dispute outcome.
4. **Dispute state:** state exactly which payout is frozen and what evidence Ops can review.

No backend or OpenAPI change is expected in T2.

Tests:

- Component tests for request/accepted/confirmed/on-hire/completed/in-dispute states.
- Existing Supplier-only money tests remain green.
- Hirer-shaped fixtures must not cause fee/payout figures to appear.
- Static prohibited-claim test mirrors mobile.
- Portal Playwright smoke covers accept → payment-pending explanation and a recorded handover.

Manual acceptance:

- Record one browser walkthrough from request queue → acceptance → hire detail → handover evidence.

### T3 — Proven transaction reputation

**Purpose:** make future demand and reputation the compounding reason not to take repeat hires offline.

**Hard gate:** production currently contains seeded demo Suppliers and simulated completed hires. No public completion count may ship until those records are either removed before launch or carry durable provenance that excludes them. Domain-string heuristics such as `@terminal-demo.invalid` are not an acceptable permanent trust boundary.

Once the gate is cleared:

- Add an additive, read-only public aggregate such as `completed_hires_through_terminal`.
- Count only Completed hires with a successful matching payment and non-demo provenance.
- Show `N paid hires completed through Terminal` on the storefront and listing Supplier block when `N > 0`; show nothing at zero.
- Start with the count only. Do not publish star ratings, dispute percentages, cancellation percentages or “top supplier” labels without sample-size and gaming rules.
- Keep aggregation N+1-free and cache-safe.
- Regenerate OpenAPI and obtain founder sign-off for the additive public contract.

Likely backend areas:

- `backend/listings/services/storefront.py`
- listing/storefront serializers or response builders
- payment-aware aggregate in a service, not a view
- focused storefront/query-count tests
- `backend/openapi/schema.yml`

Tests:

- requested, accepted, unpaid completed, refunded and demo hires do not count;
- a paid Completed real hire counts once;
- duplicate payment attempts do not double count;
- suspended/deleted Supplier visibility remains unchanged;
- query count is constant as listing count grows;
- no financial amount or counterparty identity becomes public.

### T4 — Portable hire record

**Purpose:** make Terminal useful after the transaction, especially for procurement and disputes.

Build on the existing shareable payment receipt with an authenticated, role-shaped hire record containing:

- hire reference and parties;
- listing, Yard, dates and locked Hirer total;
- state/event timeline;
- payment and refund status appropriate to the viewer;
- handover metadata and confirmations;
- links to private evidence that still require participant authorization.

Decide the export format separately. A server-rendered document is preferable for stable procurement records, but no PDF dependency should be introduced until output, font, retention and private-photo behaviour are designed. D-014 applies to every export: a Hirer export never contains Service Fee or Supplier Payout figures.

T4 is valuable but not required to release T1–T2.

## 6. Measurement

No new paid analytics service is required.

Use existing hire/payment records to establish a release-timestamp cohort baseline:

- enquiry → request conversion;
- request → acceptance;
- acceptance → Paystack-confirmed payment within the four-hour window;
- payment-window expiry;
- paid cancellation and refund completion;
- handover completion;
- dispute rate;
- repeat paid hires between the same parties.

The primary measure for T1 is **Accepted → Confirmed conversion**. The primary measure for T2 is **Confirmed hires with both handovers recorded**. The long-term anti-leakage measure is **repeat paid hires through Terminal**.

These before/after cohorts show directional impact but cannot prove that a user opened the explainer. If interaction attribution later becomes necessary, propose a small first-party event model as a separate contract/privacy decision; do not misuse Sentry as product analytics.

## 7. Release order and rollback

1. T0 copy/claims approval.
2. T1 Hirer surfaces behind one client release.
3. Review conversion and support feedback.
4. T2 Supplier surfaces.
5. T3 only after demo-data provenance is clean.
6. T4 when the core proposition is understood and used.

T1 and T2 are presentation-only and rollback by client release/OTA or portal deploy. They must not condition legal actions or state transitions on the trust component rendering. T3 is additive and must degrade by omitting the count. T4 must never make private evidence public to simplify export.

## 8. Definition of success

The work is complete when:

- a Hirer can explain, before paying, what Terminal records and what happens if the hire is cancelled or disputed;
- a Supplier can explain why payment and handover should remain on Terminal;
- every visible claim is backed by current code and policy;
- no surface describes Terminal as escrow, insurance or a guarantor;
- D-014 remains intact;
- demo transactions cannot appear as earned reputation;
- the core request, payment and handover journeys remain no slower or less legible;
- automated tests and the two role-specific walkthroughs demonstrate the claims in context.
