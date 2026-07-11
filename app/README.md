# Terminal — Hirer App (`@terminal/app`)

Expo SDK 57 · expo-router · NativeWind on `@terminal/tokens` · TanStack Query (MMKV-persisted) · Zustand. Wave 8 build brief: `docs/waves/wave-8.md`; binding look-and-feel: `docs/waves/wave-8-vision.md`.

## Development

```bash
pnpm install                       # repo root
pnpm --filter @terminal/app dev    # Metro for the dev client (not Expo Go)
```

**Expo Go cannot run this app** — MapLibre and MMKV are native modules. You need the **dev client** installed once per native-dependency change; day-to-day work is pure JS over it.

## Building the dev client (founder machine)

Android (needs Android Studio/SDK + a connected device with USB debugging):

```bash
cd app
pnpm exec expo run:android        # builds + installs the dev client, starts Metro
```

iOS goes through EAS (free tier):

```bash
pnpm exec eas build --profile development --platform ios
```

**OTA updates are ARMED** — `updates.url`, `extra.eas.projectId`, and `owner` are committed in `app.json` (no `eas init` / `eas update:configure` needed). Each merged JS-only slice ships as an OTA push **to the branch matching the installed binary's channel** — the founder's preview APK is on channel `preview`:

```bash
pnpm exec eas update --branch preview --message "slice <name>"     # preview APKs (founder device)
pnpm exec eas update --branch production --message "slice <name>"  # production builds
```

Devices apply it across **two cold launches**: launch #1 downloads in the background (`ON_LOAD`, `fallbackToCacheTimeout: 0`), launch #2 (full kill + reopen) runs the new bundle.

`runtimeVersion` is the **static string** `"0.1.1"` (the fingerprint policy was dropped to unblock EAS builds — `fingerprint.config.js` is dead config). That means: whenever native dependencies or `app.json` plugins change, **manually bump `runtimeVersion` and rebuild/reinstall the binary** — OTA only reaches binaries whose runtimeVersion matches exactly, and publishing JS that references new natives without a bump would crash instead of being refused.

**Full release procedure — builds, channels, the critical-update (S17 gate) flow, perf gate, and the mandatory J2/J3/J8 manual E2E checklist: [`docs/runbooks/app-release.md`](../docs/runbooks/app-release.md).** Bumping `extra.updates.criticalIndex` in `app.json` marks the next published update as blocking; with a static runtimeVersion the bump can never shift the runtime version by construction.

## Environment

- `EXPO_PUBLIC_API_BASE_URL` — defaults to the natural-cat prod API (`https://api-production-101c8.up.railway.app`). Point it at `http://<your-lan-ip>:8000` for a local backend.
- `EXPO_PUBLIC_SENTRY_DSN` — optional; keyless runs with Sentry inert.

## Gates (same as CI — `.github/workflows/app.yml`)

```bash
pnpm --filter @terminal/app lint
pnpm --filter @terminal/app typecheck
pnpm --filter @terminal/app test       # jest: fidelity table, api 401 discipline, D-014 walker
pnpm --filter @terminal/app export     # Metro bundle-compile gate
```

Tokens are rebuilt automatically by `pre*` hooks. Test conventions: screens render through `test/render.tsx`; hire-touching screens must pass `test/d014.ts`'s `expectNoFeeLeak`.
