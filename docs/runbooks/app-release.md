# Runbook — Hirer App release (build · OTA · manual E2E)

The repeatable release procedure for `@terminal/app` (Wave 8, TSD §6 distribution posture:
local Android builds → founder device, iOS via the EAS free tier, `expo-updates` OTA for
JS-only changes). The manual E2E checklist at the bottom is the wave's mandatory release
test — run it, on a physical device, before calling any release done.

## 1. OTA state (no one-time setup left)

**OTA is ARMED in the committed config**: `app.json` carries `updates.url`
(`https://u.expo.dev/<projectId>`), `extra.eas.projectId`, `owner`, and
`updates.checkAutomatically: ON_LOAD` / `fallbackToCacheTimeout: 0`; `eas.json` carries the
channels. `eas init` / `eas update:configure` are already done — running them again is a
no-op. `Updates.isEnabled` is true in any binary built from this config.

`runtimeVersion` is the **static string `"0.1.1"`** (the fingerprint policy was dropped to
unblock EAS builds on the pnpm monorepo). Consequences:

- `fingerprint.config.js` is dead config under the static policy; a `criticalIndex` bump
  can never shift the runtime version by construction (no sanity check needed).
- **Whenever native dependencies or `app.json` plugins change, bump `runtimeVersion` by
  hand and rebuild/reinstall** — OTA only reaches binaries whose runtimeVersion matches
  exactly. A forgotten bump ships JS referencing natives the binary doesn't have (crash)
  instead of being safely refused; a bumped version without a rebuilt binary shows up as
  "update never arrives".

**Binaries built before `updates.url` landed (pre-`b7b405e`) can never receive OTA** —
rebuild + reinstall those once.

## 2. Builds

Android, local (the founder-device path — needs Android Studio SDK + USB debugging):

```bash
cd app
pnpm exec expo run:android                         # dev client (day-to-day)
pnpm exec expo run:android --variant release       # release build for the device demo
```

**Locally-built binaries receive no OTA** — `app.json` carries no
`updates.requestHeaders["expo-channel-name"]`, so only EAS builds (which inject their
profile's channel) poll a branch. Use the EAS preview/production profiles for any binary
that must take updates.

iOS + EAS builds (free tier):

```bash
pnpm exec eas build --profile development --platform ios   # dev client
pnpm exec eas build --profile preview --platform android   # internal-distribution APK (channel: preview)
pnpm exec eas build --profile production --platform ios    # store-ready (channel: production)
```

## 3. Shipping a slice (OTA — JS-only changes)

**Automated (default path):** `.github/workflows/ota.yml` publishes to the `preview`
branch on every merge to `main` that touches `app/**` or `packages/tokens/**` — the
installed preview APK picks the slice up with no manual step. One-time setup: create an
access token at expo.dev (account → Access tokens) and add it as the **`EXPO_TOKEN`**
repository secret on GitHub; until then the workflow fails loudly. Production-channel
publishes stay deliberate and manual (below), not tied to merges.

**Manual:** publish **to the branch matching the installed binary's channel** (EAS maps a
channel to the same-named branch by default). The founder's preview APK is on channel
**`preview`** — publishing to `production` never reaches it:

```bash
cd app && pnpm exec eas update --branch preview --message "slice <name>"     # preview APKs
cd app && pnpm exec eas update --branch production --message "slice <name>"  # production builds
```

Devices apply it across **two cold launches**: launch #1 downloads in the background
(never blocking — `fallbackToCacheTimeout: 0`), launch #2 (full kill + reopen, not just
backgrounding) runs the new bundle. Rebuild the binary instead whenever `app.json` plugins
or native dependencies changed — and bump the static `runtimeVersion` when you do (§1).

### Critical (blocking) update

For an update every user must take before continuing (S17 update-required gate):

1. In `app/app.json`, bump `extra.updates.criticalIndex` by 1. Commit.
2. Publish as usual to the binary's branch: `pnpm exec eas update --branch preview --message "critical: <why>"` (or `--branch production` for production builds).

Running apps download it in the background (launch + foregrounding, throttled to 15 min)
and then block on the S17 "Update required" screen until restarted. Don't bump the index
for routine slices — every bump forces every user through the blocking screen.

## 4. Performance gate (record per release — wave-8 exit numbers)

- **Cold start < 4s to interactive map** (mid-tier Android, FSD §12):
  `adb shell am start -W -n com.terminal.hirer/.MainActivity` — read `TotalTime`, then
  stopwatch to the map accepting a pan. Record both.
- **Handover photo upload < 5s for a 5MB capture on 4G**: on-device, capture a handover
  photo on cellular and time capture-tap → thumb-rail tick (the client resizes to
  ≤1920px before the presigned PUT, so the wire payload is ~1MB).

Record the numbers in the release notes / `Implementations.md` entry for the release.

## 5. Manual E2E checklist (mandatory — J2 + J3 + J8, Paystack test mode)

Physical Android device against production (`EXPO_PUBLIC_API_BASE_URL` default), Paystack
test keys. This is the wave-8 exit-criterion script — run it verbatim, stopwatch on J2.

**J2 — discover → pay (target: install → request in under 10 minutes):**
1. Fresh install → 3-screen onboarding (skippable after ①) → continue as guest → Map.
2. Location pre-prompt → grant → map centres on you; filter a class; a YardPin shows a count.
3. Tap the YardPin → Yard Sheet (half snap) → pick a listing row → Listing Detail
   (gallery, SpecTable, AvailabilityStrip, mini-map with privacy radius).
4. Request to hire (guest → auth sheet: register + dual OTP mid-flow, intent preserved) →
   14-day range shows "14 days → 2 × weekly — best price ✓" → review shows **"You pay ₦…"
   total only — no fee or payout line anywhere (D-014)** → note → submit → "Awaiting
   supplier — 24h". ⏱ stop the stopwatch here.
5. Supplier accepts (portal, second machine) → hire card shows the 4h CountdownPill →
   Pay now → Paystack test card → return to app → "Confirming with bank…" (poll — the
   webhook is the only truth) → **PAID stamp moment + sound** → receipt share card
   (**no fee on it**) → conversation shows "Contact details unlocked".
6. Failure paths (each once): payment failure shows the mapped reason + attempts left +
   countdown persists; a 409 race shows the "dates just taken" sheet → re-pick.

**J3 — handover → off-hire:**
7. On the start date both parties see "Handover today". Capture: camera-first, ≥2 photos,
   hour-meter reading on the mono pad, submit → counterparty confirms → **both-ticks
   moment + sound** → status On Hire.
8. Airplane-mode check (D-016): capture a handover offline → it queues with "will send
   when you're back online" → reconnect → it submits itself.
9. End date: off-hire capture with return reading → both confirm → Completed.

**J8 — the second hire (two taps):**
10. Hires → History → "Hire again" atop the list → tap → new request screen for the same
    listing (tap 2). Map remembers the last region + filters across a kill/relaunch.

**System posture spot-checks (S17):**
11. Airplane mode with a warm cache: Hires/Messages render with the "Offline — showing
    saved data" strip; fresh install + airplane mode shows "You're offline" instead of a
    spinner. A dead deep link (e.g. `terminal://listing/nonsense`) lands on Not found →
    Back to Map.

Any step failing = not releasable; file it in `Implementations.md` and fix before OTA.
