import { useEffect, useRef } from "react";
import { AppState, BackHandler, StyleSheet, View } from "react-native";
import * as Updates from "expo-updates";

import {
  UPDATE_CHECK_MIN_INTERVAL_MS,
  getRunningCriticalIndex,
  isCriticalUpdate,
} from "../../lib/updates";
import { UpdateRequired } from "../system/update-required";

/**
 * S17 · OTA update gate. Normal slices ship silently: the native ON_LOAD
 * check downloads in the background and applies on the next cold launch —
 * no JS involved. This gate adds the two things the native path can't do:
 * a foreground re-check (throttled — launch-only checks miss long-lived
 * sessions), and a blocking overlay when a published update is marked
 * critical (`extra.updates.criticalIndex` bumped past the running app's).
 *
 * Rendered as an overlay, not a route: a route is escapable via back
 * navigation and deep links. Inert whenever updates are disabled — dev
 * clients, jest, and prod until `eas update:configure` adds `updates.url`.
 */
export function UpdateGate() {
  const updatesEnabled = Updates.isEnabled;
  const { availableUpdate, downloadedUpdate, isUpdateAvailable, isUpdatePending, isDownloading } =
    Updates.useUpdates();

  // Seeded on mount (not render — render must stay pure): the native
  // ON_LOAD check already ran at launch, so the first foreground re-check
  // waits out the full interval.
  const lastCheckRef = useRef(0);

  // Foreground re-check, throttled. Failures stay silent — the map still
  // works offline; the next check catches up.
  useEffect(() => {
    if (!updatesEnabled) return;
    if (lastCheckRef.current === 0) lastCheckRef.current = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Date.now() - lastCheckRef.current < UPDATE_CHECK_MIN_INTERVAL_MS) return;
      lastCheckRef.current = Date.now();
      Updates.checkForUpdateAsync().catch(() => {});
    });
    return () => sub.remove();
  }, [updatesEnabled]);

  // The launch check auto-downloads; a foreground-detected update doesn't.
  useEffect(() => {
    if (!updatesEnabled) return;
    if (isUpdateAvailable && !isUpdatePending && !isDownloading) {
      Updates.fetchUpdateAsync().catch(() => {});
    }
  }, [updatesEnabled, isUpdateAvailable, isUpdatePending, isDownloading]);

  const manifest = (downloadedUpdate ?? availableUpdate)?.manifest;
  const blocked = updatesEnabled && isCriticalUpdate(manifest, getRunningCriticalIndex());

  // While blocked, swallow Android hardware back — the covered stack must
  // stay unreachable.
  useEffect(() => {
    if (!blocked) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [blocked]);

  if (!blocked) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <UpdateRequired
        ready={isUpdatePending}
        onRestart={() => void Updates.reloadAsync().catch(() => {})}
      />
    </View>
  );
}
