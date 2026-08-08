# Runbook — Hirer App release (build · OTA · manual E2E)

The repeatable release procedure for `@terminal/mobile` (Wave 8, TSD §6 distribution posture:
local Android builds → founder device, iOS via the EAS free tier, `expo-updates` OTA for
JS-only changes). The manual E2E checklist at the bottom is the wave's mandatory release
test — run it, on a physical device, before calling any release done.

## 1. OTA state + the runtimeVersion rule (READ THIS)

**OTA is ARMED in the committed config**: `app.json` carries `updates.url`
(`https://u.expo.dev/<projectId>`), `extra.eas.projectId`, `owner`, and
`updates.checkAutomatically: ON_LOAD` / `fallbackToCacheTimeout: 0`; `eas.json` carries the
channels. `eas init` / `eas update:configure` are already done — running them again is a
no-op. `Updates.isEnabled` is true in any binary built from this config.

### `runtimeVersion` is decoupled from `version` — do NOT tie them together (2026-07-12)

`runtimeVersion` is a **static native-ABI generation string**, currently `"1"`. It is
**not** the marketing `version` (`0.1.3`) and must not track it. This is the load-bearing
OTA rule, and getting it wrong is why OTA never reached a device before:

- `expo-updates` delivers an update to a binary **only when their `runtimeVersion` strings
  match exactly.** An update published at runtimeVersion `X` is invisible to every binary
  built at any other runtimeVersion — silently, forever.
- Historically `runtimeVersion` was set equal to `version` and bumped with it
  (`0.1.1` → `0.1.3`). So every marketing bump minted a *new* runtimeVersion island and
  orphaned the installed APK from all future OTA — defeating the entire point of OTA.
- **The rule now:** bump `version` / `android.versionCode` freely on every release
  (marketing/store metadata). Leave `runtimeVersion` **alone**. Only bump `runtimeVersion`
  (e.g. `"1"` → `"2"`) when **native code changes** — a new/updated native dependency, an
  `app.json` plugin change, or an Expo SDK upgrade — and rebuild+reinstall the binary when
  you do. JS-only slices never touch it, so OTAs keep landing on the installed build.
- `fingerprint.config.js` is dead config under the static policy (fingerprint was dropped
  to unblock EAS builds on the pnpm monorepo); a `criticalIndex` bump can never shift the
  runtime version by construction.

**Consequence of the 2026-07-12 change:** the new baseline binary must be built at
runtimeVersion `"1"` and installed once; every binary built before this (runtimeVersion
`0.1.1`/`0.1.2`/`0.1.3` on any Expo account, or any local `--variant release` build with
no channel header) can never receive OTA and must be replaced by this build. The
`react-native-keyboard-controller` native module (PR #53) is baked into the `"1"` baseline —
do not bump `runtimeVersion` again for JS-only fixes.

### The three-way match (2026-08-08 re-diagnosis)

A binary receives an update only when **all three** of these agree with the published update:

1. **`runtimeVersion`** — `"1"`. A mismatch is a silent `204 No Content`, forever.
2. **channel** — `preview`. EAS builds inject it from the profile; local builds get it from
   `updates.requestHeaders["expo-channel-name"]` in `app.json` (added 2026-08-08). A binary
   built before that commit *without* an EAS profile sends no channel header and gets `400`.
3. **Expo project** — `@perble/terminal` / `a2177bd7-0417-4823-9c4a-fe70ab11d07e`. The
   repoint from `@perblis-organization` landed 2026-07-13 (`b499d19`); binaries built
   before it poll a different project entirely.

The last recorded EAS preview APK was built at `1dc5ddd` (2026-07-10) — runtimeVersion
`"0.1.1"`, old project. It fails (1) and (3), which is why no OTA has ever landed on the
founder device even though publishing has been green since 2026-07-13.

**Verify the publish side without a device** — query the update server exactly as the app
does (no auth needed; `200` = an update is waiting, `204` = nothing for that runtime,
`404` = no such channel, `400` = missing headers):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'expo-platform: android' -H 'expo-runtime-version: 1' \
  -H 'expo-channel-name: preview' -H 'expo-protocol-version: 1' \
  -H 'accept: multipart/mixed, application/expo+json, application/json' \
  https://u.expo.dev/a2177bd7-0417-4823-9c4a-fe70ab11d07e
```

**Verify the device side:** `pnpm exec eas build:list --platform android --limit 5` and read
the `Runtime version` + `Channel` of the build that is actually installed.

## 2. Builds

Android, local (the founder-device path — needs Android Studio SDK + USB debugging):

```bash
cd mobile
pnpm exec expo run:android                         # dev client (day-to-day)
pnpm exec expo run:android --variant release       # release build for the device demo
```

**Local builds now DO receive OTA (2026-08-08).** `app.json` carries
`updates.requestHeaders["expo-channel-name"]: "preview"` — the documented way to set a
channel on a non-EAS build in a CNG project. A local `--variant release` APK polls the
`preview` channel exactly like an EAS preview build, so the whole binary path can run
without an Expo account: **you build locally, CI publishes.** (Before this, local builds
sent no channel header and the server answered `400`.)

Requirements and caveats for the local path:

- Android SDK + JDK on the build machine. **No `eas login` and no `EXPO_TOKEN`** —
  `expo run:android` is plain prebuild + Gradle. Note `eas build --local` is *not* this:
  it still authenticates to resolve the project slug and pull credentials.
- **Signing differs from EAS**, so Android refuses an in-place upgrade over an
  EAS-built APK. Uninstall the old app first — that clears SecureStore tokens and the
  MMKV cache, so you sign in fresh.
- If you later switch back to EAS Build, its profile `channel` is what gets applied.
  Verify which wins before running a mixed workflow.
- Publishing still needs auth, but that lives in CI (`EXPO_TOKEN` repo secret) — not on
  your machine.

iOS + EAS builds (free tier):

```bash
pnpm exec eas build --profile development --platform ios   # dev client
pnpm exec eas build --profile preview --platform android   # internal-distribution APK (channel: preview)
pnpm exec eas build --profile production --platform ios    # store-ready (channel: production)
```

## 3. Shipping a slice (OTA — JS-only changes)

**Automated (default path):** `.github/workflows/ota.yml` publishes to the `preview`
branch on every merge to `main` that touches `mobile/**` or `packages/tokens/**` — the
installed preview APK picks the slice up with no manual step. The **`EXPO_TOKEN`** repository
secret this needs was added 2026-07-13 and the job has been green on every push since — it is
the only place an Expo credential is required, which is what frees the local build path from
needing one. Production-channel publishes stay deliberate and manual (below), not tied to
merges.

**Manual:** publish **to the branch matching the installed binary's channel** (EAS maps a
channel to the same-named branch by default). The founder's preview APK is on channel
**`preview`** — publishing to `production` never reaches it:

```bash
cd mobile && pnpm exec eas update --branch preview --message "slice <name>"     # preview APKs
cd mobile && pnpm exec eas update --branch production --message "slice <name>"  # production builds
```

Devices apply it across **two cold launches**: launch #1 downloads in the background
(never blocking — `fallbackToCacheTimeout: 0`), launch #2 (full kill + reopen, not just
backgrounding) runs the new bundle. Rebuild the binary instead whenever `app.json` plugins
or native dependencies changed — and bump the static `runtimeVersion` when you do (§1).

### Critical (blocking) update

For an update every user must take before continuing (S17 update-required gate):

1. In `mobile/app.json`, bump `extra.updates.criticalIndex` by 1. Commit.
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

## 6. Self-hosting the update server (evaluated 2026-08-08 — NOT adopted)

`expo-updates` speaks an open protocol ([Expo Updates v1](https://docs.expo.dev/technical-specs/expo-updates-1/)),
so `updates.url` can point at any conformant server — including one on the VPS behind the
existing nginx ingress, which is consistent with the D-027 self-hosting direction. Expo
publishes a reference implementation ([`expo/custom-expo-updates-server`](https://github.com/expo/custom-expo-updates-server))
and there are production-grade OSS servers (e.g. `expo-open-ota`).

**What it would take:** serve `/manifest` and `/assets` per the spec, keyed on the
`expo-platform` / `expo-runtime-version` / `expo-channel-name` headers; run `expo export`
yourself and store the bundles; implement channel→release routing (channels are an EAS
concept, so the routing logic becomes yours); optionally implement code signing
(`expo-expect-signature` / `expo-signature`). `.github/workflows/ota.yml` would be rewritten
from `eas update` to export-and-upload, and rollbacks/rollouts would be hand-rolled.

**Why not now:**

- It fixes nothing currently broken. The 2026-08-08 diagnosis proved publishing is green
  and the server healthy; the only defect was a stale binary. Self-hosting would swap a
  working component for one we'd have to build and operate.
- `updates.url` is **native config** — changing it later means yet another baseline
  rebuild + reinstall. Doing it now to avoid that is the only real argument for it, and it
  is weaker than the operational cost.
- EAS Update's free tier already covers this project's volume at $0, so it does not press
  on the ≤$25/month guardrail. Serving 6.6 MB bundles + ~84 assets per release from the VPS
  moves that bandwidth onto our own box for no gain.
- It adds a service to keep alive on the critical path of shipping fixes to devices. If it
  is down, we cannot ship — where today an outage is Expo's problem.

**Revisit if** any of these change: EAS Update pricing stops covering our volume, a
compliance requirement forbids third-party update hosting, or we need routing/rollout logic
EAS cannot express. Until then this is a deliberate no, not an oversight — do not
re-litigate it in code.
