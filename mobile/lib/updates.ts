import Constants from "expo-constants";
import type * as Updates from "expo-updates";

/**
 * S17 update-required gate logic (pure — the UpdateGate shell component
 * owns the expo-updates wiring).
 *
 * "Critical" is a client-side contract with the publish flow: bumping
 * `extra.updates.criticalIndex` in app.json before `eas update` marks that
 * update as blocking. The gate compares the index embedded in the
 * available/downloaded update's manifest against the running app's, and
 * blocks while the update's is higher. `fingerprint.config.js` keeps the
 * bump from shifting the fingerprint runtime version — without it the
 * critical update could never reach existing binaries.
 */

type ExtraWithUpdates = { updates?: { criticalIndex?: unknown } };

function readCriticalIndex(extra: unknown): number {
  const idx = (extra as ExtraWithUpdates | undefined)?.updates?.criticalIndex;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : 0;
}

/**
 * The published app-config extra of an update lives at
 * `manifest.extra.expoClient.extra` (expo-updates protocol manifests).
 * Embedded manifests carry no `extra` key and rollback directives carry no
 * manifest at all — both read as 0 (never critical).
 */
export function getManifestCriticalIndex(manifest: Partial<Updates.Manifest> | undefined): number {
  if (!manifest || !("extra" in manifest)) return 0;
  return readCriticalIndex(manifest.extra?.expoClient?.extra);
}

/** The running update's own criticalIndex (expo-constants reflects it). */
export function getRunningCriticalIndex(): number {
  return readCriticalIndex(Constants.expoConfig?.extra);
}

export function isCriticalUpdate(
  manifest: Partial<Updates.Manifest> | undefined,
  runningIndex: number,
): boolean {
  return getManifestCriticalIndex(manifest) > runningIndex;
}

/** Foreground re-check throttle — OTA cadence is per-slice, not per-minute. */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 15 * 60_000;
