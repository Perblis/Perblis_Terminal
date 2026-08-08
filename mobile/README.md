# Terminal — Hirer App (`@terminal/mobile`)

Expo SDK 57 · expo-router · NativeWind on `@terminal/tokens` · TanStack Query (MMKV-persisted) · Zustand. Wave 8 build brief: `docs/waves/wave-8.md`; binding look-and-feel: `docs/waves/wave-8-vision.md`.

## Development

```bash
pnpm install                       # repo root
pnpm --filter @terminal/mobile dev # Metro for the dev client (not Expo Go)
```

**Expo Go cannot run this app** — MapLibre and MMKV are native modules. You need the **dev client** installed once per native-dependency change; day-to-day work is pure JS over it.

## Building the dev client (founder machine)

Android (needs Android Studio/SDK + a connected device with USB debugging):

```bash
cd mobile
pnpm exec expo run:android        # builds + installs the dev client, starts Metro
```

iOS goes through EAS (free tier):

```bash
pnpm exec eas build --profile development --platform ios
```

**OTA updates are ARMED and publish automatically** — `updates.url`, `extra.eas.projectId`, and `owner` are committed in `app.json`, and `.github/workflows/ota.yml` runs `eas update --branch preview` on every push to `main` touching `mobile/**` or `packages/tokens/**`. Manual publishes go **to the branch matching the installed binary's channel**; the founder's preview APK is on channel `preview`:

```bash
pnpm exec eas update --branch preview --message "slice <name>"     # preview APKs (founder device)
pnpm exec eas update --branch production --message "slice <name>"  # production builds
```

Devices apply it across **two cold launches**: launch #1 downloads in the background (`ON_LOAD`, `fallbackToCacheTimeout: 0`), launch #2 (full kill + reopen) runs the new bundle.

`runtimeVersion` is the **static string** `"1"` — a native-ABI generation marker, deliberately decoupled from the marketing `version` (`0.1.3`). Bump `version` / `android.versionCode` freely; touch `runtimeVersion` **only** when native dependencies, `app.json` plugins, or the Expo SDK change, and rebuild + reinstall the binary when you do. `expo-updates` delivers an update only to binaries whose `runtimeVersion` matches **exactly** — a mismatch is a silent `204 No Content` forever. `fingerprint.config.js` is dead config under this policy.

**A binary only receives OTA if all three match: `runtimeVersion` `"1"`, channel `preview`, and Expo project `@perble/terminal` (`a2177bd7-…`).** Binaries built before 2026-07-13 fail at least one of these and are permanently OTA-deaf — replace them.

**Local release builds now take OTA too.** `app.json` sets `updates.requestHeaders["expo-channel-name"]: "preview"` — the documented way to pin a channel on a non-EAS build in a CNG project — so `expo run:android --variant release` polls the same channel an EAS preview build does. That means **no Expo account is needed to build**: you build locally, CI publishes (`EXPO_TOKEN` lives only in GitHub Actions). Caveat: local signing differs from EAS, so uninstall any EAS-built APK first — Android refuses an in-place upgrade across signing keys, and the uninstall clears SecureStore + MMKV.

**Full release procedure — builds, channels, the critical-update (S17 gate) flow, perf gate, and the mandatory J2/J3/J8 manual E2E checklist: [`docs/runbooks/app-release.md`](../docs/runbooks/app-release.md).** Bumping `extra.updates.criticalIndex` in `app.json` marks the next published update as blocking; with a static runtimeVersion the bump can never shift the runtime version by construction.

## Environment

```bash
cd mobile
./scripts/setup-env.sh              # writes .env.local (prod hosts, from Infisical /mobile)
./scripts/setup-env.sh --target local   # point at your own backend over the LAN IP
./scripts/setup-env.sh --check      # audit config drift + host reachability, write nothing
```

Full key list with comments: [`.env.example`](.env.example). Three variables, all optional:

- `EXPO_PUBLIC_API_BASE_URL` — defaults to the D-027 VPS prod API (`https://terminal-api.lab.perblis.com`). Use `http://<your-lan-ip>:8000` for a local backend — **not** `localhost`, which resolves to the phone itself.
- `EXPO_PUBLIC_PORTAL_URL` — defaults to the VPS Supplier Portal (`https://terminal.lab.perblis.com`); used for the F8 hand-off and legal links.
- `EXPO_PUBLIC_SENTRY_DSN` — optional; keyless runs with Sentry inert.

Two rules that bite:

1. **Dotenv files never reach a device.** `.env*` is gitignored; EAS Build uploads via git and `ota.yml` checks out git, so both ship the **committed defaults in `lib/api.ts`**. Changing what a released APK talks to means editing `lib/api.ts` and merging it. `setup-env.sh --check` fails loudly if that default has gone stale — it is the guard that would have caught the D-027 cutover leaving the app pointed at the decommissioned Railway host.
2. **`EXPO_PUBLIC_*` is public.** Expo inlines each value into the JS bundle; anyone who unzips the APK can read it. Configuration only, never secrets. Real secrets (`EXPO_TOKEN` for EAS) live in Infisical and are injected per command:

```bash
infisical run --env=prod --path=/mobile -- pnpm exec eas build --profile preview --platform android
```

## Gates (same as CI — `.github/workflows/mobile.yml`)

```bash
pnpm --filter @terminal/mobile lint
pnpm --filter @terminal/mobile typecheck
pnpm --filter @terminal/mobile test       # jest: fidelity table, api 401 discipline, D-014 walker
pnpm --filter @terminal/mobile export     # Metro bundle-compile gate
```

Tokens are rebuilt automatically by `pre*` hooks. Test conventions: screens render through `test/render.tsx`; hire-touching screens must pass `test/d014.ts`'s `expectNoFeeLeak`.
