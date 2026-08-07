// S17 · update-required OTA gate: inert when updates are disabled, silent
// for non-critical updates, blocking (with restart) for critical ones.
import { fireEvent } from "@testing-library/react-native";
import * as Updates from "expo-updates";

import { UpdateGate } from "../../components/shell/update-gate";
import { renderScreen } from "../render";

const mockUseUpdates = Updates.useUpdates as jest.Mock;

const IDLE = {
  currentlyRunning: { isEmbeddedLaunch: true, isEmergencyLaunch: false },
  isUpdateAvailable: false,
  isUpdatePending: false,
  isChecking: false,
  isDownloading: false,
  isRestarting: false,
  restartCount: 0,
  isStartupProcedureRunning: false,
};

function criticalManifest(criticalIndex: number) {
  return {
    id: "u1",
    createdAt: "2026-07-10T00:00:00Z",
    runtimeVersion: "abc",
    launchAsset: { url: "https://u.expo.dev/a" },
    assets: [],
    metadata: {},
    extra: { expoClient: { name: "Terminal", slug: "terminal", extra: { updates: { criticalIndex } } } },
  };
}

function setEnabled(enabled: boolean) {
  Object.defineProperty(Updates, "isEnabled", { value: enabled, configurable: true });
}

afterEach(() => setEnabled(false));

describe("UpdateGate (S17 update-required)", () => {
  test("inert when updates are disabled, even with a critical update pending", async () => {
    setEnabled(false);
    mockUseUpdates.mockReturnValue({
      ...IDLE,
      isUpdateAvailable: true,
      isUpdatePending: true,
      downloadedUpdate: { type: "new", updateId: "u1", manifest: criticalManifest(1) },
    });
    const screen = await renderScreen(<UpdateGate />);
    expect(screen.queryByText("Update required")).toBeNull();
  });

  test("silent for a non-critical downloaded update (applies next cold launch)", async () => {
    setEnabled(true);
    mockUseUpdates.mockReturnValue({
      ...IDLE,
      isUpdateAvailable: true,
      isUpdatePending: true,
      downloadedUpdate: { type: "new", updateId: "u1", manifest: criticalManifest(0) },
    });
    const screen = await renderScreen(<UpdateGate />);
    expect(screen.queryByText("Update required")).toBeNull();
  });

  test("critical downloaded update blocks; restart calls reloadAsync", async () => {
    setEnabled(true);
    mockUseUpdates.mockReturnValue({
      ...IDLE,
      isUpdateAvailable: true,
      isUpdatePending: true,
      downloadedUpdate: { type: "new", updateId: "u1", manifest: criticalManifest(1) },
    });
    const screen = await renderScreen(<UpdateGate />);
    expect(screen.getByText("Update required")).toBeTruthy();
    fireEvent.press(screen.getByText("Restart to update"));
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });

  test("critical update still downloading: blocked, restart busy, fetch kicked", async () => {
    setEnabled(true);
    mockUseUpdates.mockReturnValue({
      ...IDLE,
      isUpdateAvailable: true,
      availableUpdate: { type: "new", updateId: "u1", manifest: criticalManifest(1) },
    });
    const screen = await renderScreen(<UpdateGate />);
    expect(screen.getByText("Update required")).toBeTruthy();
    // Busy button renders a spinner instead of its label and can't fire.
    expect(screen.queryByText("Restart to update")).toBeNull();
    expect(Updates.fetchUpdateAsync).toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });
});
