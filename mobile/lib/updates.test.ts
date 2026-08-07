// Update-gate pure logic: critical detection tolerates every missing level
// of the manifest extra path; embedded/rollback manifests are never critical.
import { getManifestCriticalIndex, isCriticalUpdate } from "./updates";

function manifestWithIndex(criticalIndex: unknown) {
  return {
    id: "u1",
    createdAt: "2026-07-10T00:00:00Z",
    runtimeVersion: "abc",
    launchAsset: { url: "https://u.expo.dev/a" },
    assets: [],
    metadata: {},
    extra: { expoClient: { name: "Terminal", slug: "terminal", extra: { updates: { criticalIndex } } } },
  } as never;
}

describe("getManifestCriticalIndex", () => {
  test("reads the published extra.updates.criticalIndex", () => {
    expect(getManifestCriticalIndex(manifestWithIndex(3))).toBe(3);
  });

  test.each([
    ["no manifest (rollback directive)", undefined],
    ["embedded manifest (no extra key)", { id: "e1", commitTime: "t", assets: [] } as never],
    ["extra without expoClient", { extra: {} } as never],
    ["expoClient without extra", { extra: { expoClient: { name: "t", slug: "t" } } } as never],
    ["non-numeric criticalIndex", manifestWithIndex("3")],
  ])("%s → 0", (_label, manifest) => {
    expect(getManifestCriticalIndex(manifest)).toBe(0);
  });
});

describe("isCriticalUpdate", () => {
  test("blocks only when the update's index is higher than the running one", () => {
    expect(isCriticalUpdate(manifestWithIndex(1), 0)).toBe(true);
    expect(isCriticalUpdate(manifestWithIndex(1), 1)).toBe(false);
    expect(isCriticalUpdate(manifestWithIndex(0), 0)).toBe(false);
    expect(isCriticalUpdate(undefined, 0)).toBe(false);
  });
});
