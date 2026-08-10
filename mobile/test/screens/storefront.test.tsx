// S13 storefront. First screen test for this surface — it had none, and the
// 2026-08-10 restructure added three behaviours worth pinning: a deterministic
// order the API does not provide, a bounded per-facility spec fan-out, and a
// capability row that must survive a facility whose read fails.
import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import Storefront from "../../app/supplier/[id]";
import { FACILITY_SPEC_CAP } from "../../lib/queries";
import type { Me } from "../../lib/types";
import { useSession } from "../../stores/session";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "s1" }),
}));

const YARD = {
  id: "y1",
  name: "Isolo Cold Hub",
  point: { type: "Point", coordinates: [3.3211, 6.5316] },
  listing_count: 3,
};

// uuid7 ids: lexicographic order IS creation order. Deliberately supplied to
// the screen in reverse so the sort has something to do.
const FROZEN = {
  id: "0199a000-0000-7000-8000-000000000001",
  title: "Frozen Store −18°C — 800 sqm, 24/7 monitoring",
  asset_class: "warehousing",
  asset_type: "Cold Storage",
  daily_price_display: "₦340,000",
  cover_photo_url: "frozen.jpg",
  yard_id: "y1",
};
const CHILLED = { ...FROZEN, id: "0199a000-0000-7000-8000-000000000002", title: "Chilled Store 0–8°C — 500 sqm produce room", daily_price_display: "₦220,000" };
const AMBIENT = { ...FROZEN, id: "0199a000-0000-7000-8000-000000000003", title: "Ambient Warehouse 1,200 sqm — beside the cold hub", asset_type: "Dry Warehouse", daily_price_display: "₦160,000" };

const STOREFRONT = {
  supplier_id: "s1",
  business_name: "Greenfield Cold Chain Ltd",
  logo_url: "",
  verification_badge: "verified",
  member_since: "2026-06-01",
  about: "Temperature-controlled storage for food, pharmaceutical and agro exporters.",
  yards: [YARD],
  // Reverse id order on purpose — the screen must impose the order.
  live_listings: [AMBIENT, CHILLED, FROZEN],
};

/** What GET /storefronts/{id} now returns per listing (D-030). */
const SPECS: Record<string, Record<string, unknown>> = {
  [FROZEN.id]: { floor_area: 800, temperature_range: "Frozen −18°C", temperature_monitoring: true, backup_power: true, dock_levellers: true, loading_bays: 3, power_supply: "Three-phase", truck_access: "Trailer-accessible" },
  [CHILLED.id]: { floor_area: 500, temperature_range: "Chilled 0–8°C", temperature_monitoring: true, backup_power: true, loading_bays: 2, power_supply: "Three-phase", truck_access: "Trailer-accessible" },
  [AMBIENT.id]: { floor_area: 1200, backup_power: true, racking_installed: true, pallet_positions: 900, loading_bays: 2, power_supply: "Three-phase", truck_access: "Trailer-accessible" },
};

/** Fee-bearing siblings the storefront must never render (D-014). */
const FEE_POISON = { service_fee: 3400000, payout_amount: 30600000, service_fee_display: "₦34,000" };

let listingCalls: string[] = [];

/** The storefront as the current API serves it: specs/tier/available inline. */
function withPayloadSpecs(listings: Record<string, unknown>[]) {
  return listings.map((l) => ({
    ...l,
    specs: SPECS[l.id as string] ?? {},
    tier: "verified",
    available: true,
  }));
}

function mockApi(storefront: unknown = STOREFRONT, failing: string[] = []) {
  listingCalls = [];
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/storefronts/")) {
      return { ok: true, status: 200, json: async () => storefront } as unknown as Response;
    }
    const match = /\/listings\/([^?]+)/.exec(u);
    if (match) {
      const id = match[1];
      listingCalls.push(id);
      if (failing.includes(id)) {
        return { ok: false, status: 404, json: async () => ({ error: { code: "not_found", message: "gone" } }) } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, specs: SPECS[id] ?? {}, tier: "verified", photos: [], ...FEE_POISON }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockApi({ ...STOREFRONT, live_listings: withPayloadSpecs(STOREFRONT.live_listings) });
  useSession.setState({ me: null, hydrated: true });
});

test("the facilities lead, with capabilities read from their specs", async () => {
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");

  expect(screen.getByText("AVAILABLE TO HIRE")).toBeTruthy();
  // Warehousing-only storefront → the class-aware noun (D-029).
  expect(screen.getByText("3 facilities · Isolo Cold Hub")).toBeTruthy();

  // Every facility's price is on screen without opening anything.
  expect(screen.getByText("₦340,000")).toBeTruthy();
  expect(screen.getByText("₦220,000")).toBeTruthy();
  expect(screen.getByText("₦160,000")).toBeTruthy();

  // Capabilities arrive from GET /listings/{id} and distinguish the rooms.
  expect(await screen.findByText("Temperature monitoring · Backup power · Dock levellers")).toBeTruthy();
  expect(screen.getByText("Backup power · Racking installed · 2 loading bays")).toBeTruthy();
});

test("order is imposed by the client, because the API does not provide one", async () => {
  // The fixture returns Ambient, Chilled, Frozen; ids are uuid7 so the screen
  // must render Frozen, Chilled, Ambient.
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");
  const strings = collectStrings(screen.toJSON() as never);
  const frozen = strings.findIndex((s) => s.includes("Frozen Store"));
  const chilled = strings.findIndex((s) => s.includes("Chilled Store"));
  const ambient = strings.findIndex((s) => s.includes("Ambient Warehouse"));
  expect(frozen).toBeGreaterThanOrEqual(0);
  expect(frozen).toBeLessThan(chilled);
  expect(chilled).toBeLessThan(ambient);
});

test("capabilities come off the storefront payload — no per-facility read at all", async () => {
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Temperature monitoring · Backup power · Dock levellers");
  // D-030 put specs on the storefront payload, so the fan-out that used to cost
  // one request per card must now cost nothing.
  expect(listingCalls).toEqual([]);
});

test("availability and tier render from the payload, without waiting on a read", async () => {
  mockApi({
    ...STOREFRONT,
    live_listings: withPayloadSpecs(STOREFRONT.live_listings).map((l, i) =>
      i === 0 ? { ...l, available: false } : l,
    ),
  });
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");
  // Colour PLUS label — the caption is the signal, not the hue.
  expect(screen.getByText("Currently on hire")).toBeTruthy();
  expect(screen.getAllByText("Available now").length).toBe(2);
  expect(listingCalls).toEqual([]);
});

test("an API older than D-030 still works — the fallback reads each facility", async () => {
  // Production backend deploys are manual, so new JS can meet an old API.
  mockApi(STOREFRONT);
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Temperature monitoring · Backup power · Dock levellers");
  expect(listingCalls.sort()).toEqual([FROZEN.id, CHILLED.id, AMBIENT.id].sort());
});

test("the fan-out is capped, and the facilities past the cap still render fully", async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    ...FROZEN,
    id: `0199a000-0000-7000-8000-0000000${String(100 + i)}`,
    title: `Cold Room ${i + 1} — ${100 + i} sqm`,
    daily_price_display: `₦${i + 1}0,000`,
  }));
  // No specs on the payload → the fallback path, which is what the cap bounds.
  mockApi({ ...STOREFRONT, live_listings: many });
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");
  await screen.findByText("Cold Room 1");

  expect(listingCalls.length).toBe(FACILITY_SPEC_CAP);
  // The 20th card is past the cap: it has no specs, and still shows its name,
  // its size and its price — the capability row falls back to real data.
  expect(screen.getByText("Cold Room 20")).toBeTruthy();
  expect(screen.getByText("₦200,000")).toBeTruthy();
});

test("a facility whose spec read 404s keeps its card and shows no error", async () => {
  mockApi(STOREFRONT, [FROZEN.id]);
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");
  // Its card survives on the fallback line…
  expect(screen.getByText("Frozen Store −18°C")).toBeTruthy();
  expect(screen.getByText("Cold Storage")).toBeTruthy();
  // …and its siblings still resolve.
  expect(await screen.findByText("Backup power · Racking installed · 2 loading bays")).toBeTruthy();
  expect(screen.queryByText("This company isn’t available")).toBeNull();
});

test("no fee vocabulary reaches the storefront, even though the listing reads carry it (D-014)", async () => {
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Temperature monitoring · Backup power · Dock levellers");
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("a mixed-class storefront says listings, not facilities", async () => {
  mockApi({
    ...STOREFRONT,
    live_listings: [
      FROZEN,
      { ...CHILLED, asset_class: "plant_machinery", asset_type: "Excavator", title: "CAT 320D — 22t" },
    ],
  });
  const screen = await renderScreen(<Storefront />);
  await screen.findByText("Greenfield Cold Chain Ltd");
  // A cold room and an excavator on one page: "facilities" would be wrong and
  // "assets" would be tone-deaf, so the Lexicon's own word wins.
  expect(screen.getByText("2 listings · Isolo Cold Hub")).toBeTruthy();
});

test("a guest's Message parks the intent and routes to login", async () => {
  const screen = await renderScreen(<Storefront />);
  await fireEvent.press(await screen.findByText("Message Greenfield Cold Chain Ltd"));
  expect(router.push).toHaveBeenCalledWith("/auth/login");
});

test("a signed-in hirer's Message opens a thread instead", async () => {
  useSession.setState({ me: { id: "me1", full_name: "Ada Obi" } as Me, hydrated: true });
  const screen = await renderScreen(<Storefront />);
  await fireEvent.press(await screen.findByText("Message Greenfield Cold Chain Ltd"));
  expect(router.push).not.toHaveBeenCalledWith("/auth/login");
});
