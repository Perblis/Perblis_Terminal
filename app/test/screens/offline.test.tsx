// 8F offline posture: S17 offline-no-cache when a cold screen has nothing
// persisted, the "Offline — showing saved data" strip when it does, and the
// account_suspended API signal routing to the S17 blocking screen.
import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";

import HiresTab from "../../app/(tabs)/hires";
import { SuspendedGate } from "../../components/shell/suspended-gate";
import { apiFetch } from "../../lib/api";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const mockNetInfoListener = (isConnected: boolean) => {
  (NetInfo.addEventListener as jest.Mock).mockImplementation(
    (cb: (s: { isConnected: boolean }) => void) => {
      cb({ isConnected });
      return () => {};
    },
  );
};

function hire(id: string) {
  return {
    id,
    listing_id: `l-${id}`,
    listing_title: `Asset ${id}`,
    asset_class: "plant_machinery",
    yard_id: "y1",
    listing_photo: null,
    start_date: "2026-08-10",
    end_date: "2026-08-23",
    duration_days: 14,
    scheme: "weekly",
    status: "requested",
    hire_value: 87700000,
    hire_value_display: "₦877,000",
    cancelled_by: null,
    decline_reason: "",
    cancel_reason: "",
    hirer_note: "",
    request_expires_at: null,
    payment_deadline: null,
    created_at: "2026-08-07T12:00:00Z",
  };
}

describe("S17 offline-no-cache (S9 Hires)", () => {
  test("offline with nothing persisted renders the offline state, not a spinner", async () => {
    mockNetInfoListener(false);
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as never;
    const screen = await renderScreen(<HiresTab />);
    expect(await screen.findByText("You’re offline")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  test("offline with data shows the saved-data strip instead", async () => {
    mockNetInfoListener(false);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [hire("h1")], next: null }),
    })) as never;
    const screen = await renderScreen(<HiresTab />);
    expect(await screen.findByText("Offline — showing saved data")).toBeTruthy();
    expect(screen.getByText("Asset h1")).toBeTruthy();
    expect(screen.queryByText("You’re offline")).toBeNull();
  });

  test("online: no offline surfaces at all", async () => {
    mockNetInfoListener(true);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [hire("h1")], next: null }),
    })) as never;
    const screen = await renderScreen(<HiresTab />);
    expect(await screen.findByText("Asset h1")).toBeTruthy();
    expect(screen.queryByText("Offline — showing saved data")).toBeNull();
    expect(screen.queryByText("You’re offline")).toBeNull();
  });
});

describe("SuspendedGate (F12 → S17)", () => {
  test("an account_suspended API error replaces to the blocking screen", async () => {
    mockNetInfoListener(true);
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "account_suspended", message: "This account is suspended." },
      }),
    })) as never;
    await renderScreen(<SuspendedGate />);
    await expect(apiFetch("/me")).rejects.toMatchObject({ code: "account_suspended" });
    expect(router.replace).toHaveBeenCalledWith("/system/suspended");
  });
});
