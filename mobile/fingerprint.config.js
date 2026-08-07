/**
 * Fingerprint runtime-version policy config (expo-updates OTA).
 *
 * `runtimeVersion: {policy: "fingerprint"}` hashes the normalized Expo
 * config INCLUDING `extra` by default — so bumping
 * `extra.updates.criticalIndex` (the S17 update-required gate's signal)
 * would change the runtime version and strand the critical update on a
 * runtime no shipped binary has. These skips keep the fingerprint stable
 * across: criticalIndex bumps (ExpoConfigExtraSection), the founder's
 * `eas init`/`eas update:configure` adding owner/projectId/updates.url
 * (ExpoConfigEASProject), and display-version bumps (ExpoConfigVersions).
 *
 * Sanity check after changing this file or app.json:
 *   npx expo-updates fingerprint:generate --platform android
 * must produce the same hash before and after a criticalIndex bump.
 *
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: ["ExpoConfigExtraSection", "ExpoConfigEASProject", "ExpoConfigVersions"],
};
