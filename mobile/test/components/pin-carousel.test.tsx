// S4 snap-to-pin carousel: cards render yard summaries + listing summaries,
// swiping (viewability) selects the card's pin, tapping opens it, and the
// pin→card snap never re-fires selection (feedback-loop guard).
import { fireEvent, render } from "@testing-library/react-native";
import { Dimensions, FlatList } from "react-native";

import {
  PinCarousel,
  carouselItems,
  makeSnapPlanner,
  makeViewabilityHandler,
} from "../../components/map/pin-carousel";
import type { MapSoloListing, MapYard } from "../../lib/types";

const SOLO: MapSoloListing = {
  id: "l1",
  title: "20t Excavator",
  asset_class: "plant_machinery",
  point: { type: "Point", coordinates: [3.4, 6.45] },
  price_from: 25000000,
  price_from_display: "₦250,000",
  distance_km: 2.1,
  photo: "",
  badge: "verified",
  available: true,
};

const YARD: MapYard = {
  yard_id: "y1",
  name: "Apapa Yard",
  point: { type: "Point", coordinates: [3.36, 6.44] },
  supplier: { id: "s1", name: "Kano Heavy Co", logo: "", badge: "verified" },
  listing_count: 8,
  matching_count: 3,
  class_mix: ["plant_machinery", "trucks_haulage"],
  price_from: 25000000,
  price_from_display: "₦250,000",
  listings: [
    { id: "l2", title: "Crane", asset_class: "plant_machinery", price_from: 1, price_from_display: "₦1", photo: "", available: true },
    { id: "l3", title: "Forklift", asset_class: "plant_machinery", price_from: 1, price_from_display: "₦1", photo: "", available: false },
  ] as MapYard["listings"],
};

const ITEMS = carouselItems([YARD], [SOLO]);

test("carouselItems puts yard cards before solo cards", () => {
  expect(ITEMS.map((i) => i.kind)).toEqual(["yard", "listing"]);
});

test("yard card shows the summary (assets, availability, from-price)", async () => {
  const screen = await render(
    <PinCarousel items={ITEMS} selection={null} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
  );
  expect(screen.getByText("Apapa Yard")).toBeTruthy();
  expect(screen.getByText("8 assets · 1 available")).toBeTruthy();
  expect(screen.getByText("Assets →")).toBeTruthy();
  expect(screen.getByText("20t Excavator")).toBeTruthy(); // the solo card
});

test("tapping a card opens it", async () => {
  const onOpen = jest.fn();
  const screen = await render(
    <PinCarousel items={ITEMS} selection={null} onActive={jest.fn()} onOpen={onOpen} bottomInset={0} />,
  );
  await fireEvent.press(screen.getByLabelText("Yard: Apapa Yard"));
  expect(onOpen).toHaveBeenCalledWith(ITEMS[0]);
});

function freshGuards(over: Partial<Record<"snapInFlight" | "activeKey" | "lastReportedKey", unknown>> = {}) {
  return {
    snapInFlight: { current: false, ...(over.snapInFlight as object) },
    activeKey: { current: null as string | null, ...(over.activeKey as object) },
    lastReportedKey: { current: null as string | null, ...(over.lastReportedKey as object) },
  };
}

test("a swipe (viewability change) activates the focused card's pin", () => {
  const onActive = jest.fn();
  const guards = freshGuards();
  const handler = makeViewabilityHandler(guards, { current: onActive });
  handler({ viewableItems: [{ item: ITEMS[1], isViewable: true, key: "l-l1", index: 1 } as never] });
  expect(onActive).toHaveBeenCalledWith(ITEMS[1]);
  expect(guards.lastReportedKey.current).toBe("l-l1");
});

test("a pin→card snap in flight suppresses re-selection (feedback-loop guard)", () => {
  const onActive = jest.fn();
  const guards = freshGuards({ snapInFlight: { current: true } });
  const handler = makeViewabilityHandler(guards, { current: onActive });
  handler({ viewableItems: [{ item: ITEMS[0], isViewable: true, key: "y-y1", index: 0 } as never] });
  expect(onActive).not.toHaveBeenCalled();
});

test("focusing the already-selected card is a no-op (realign echo)", () => {
  const onActive = jest.fn();
  const guards = freshGuards({ activeKey: { current: "y-y1" } });
  const handler = makeViewabilityHandler(guards, { current: onActive });
  handler({ viewableItems: [{ item: ITEMS[0], isViewable: true, key: "y-y1", index: 0 } as never] });
  expect(onActive).not.toHaveBeenCalled();
  expect(guards.lastReportedKey.current).toBeNull();
});

describe("snap planner (selection→carousel decisions)", () => {
  test("a swipe's own echo holds still; the next pin tap still snaps (wedge regression)", () => {
    const guards = freshGuards();
    const handler = makeViewabilityHandler(guards, { current: jest.fn() });
    const plan = makeSnapPlanner(guards);
    // Swipe to the solo card → the parent echoes it back as the selection.
    handler({ viewableItems: [{ item: ITEMS[1], isViewable: true, key: "l-l1", index: 1 } as never] });
    expect(plan("l-l1", 1)).toBe("hold");
    // A genuine pin tap right after the swipe must still snap.
    expect(plan("y-y1", 0)).toBe("snap");
  });

  test("an external selection snaps; the same selection re-planned holds", () => {
    const plan = makeSnapPlanner(freshGuards());
    expect(plan("y-y1", 0)).toBe("snap");
    expect(plan("y-y1", 0)).toBe("hold");
  });

  test("an index shift under the same selection realigns (data reorder)", () => {
    const plan = makeSnapPlanner(freshGuards());
    expect(plan("l-l1", 3)).toBe("snap");
    expect(plan("l-l1", 1)).toBe("realign");
  });

  test("a vanished selection or cleared selection holds", () => {
    const plan = makeSnapPlanner(freshGuards());
    expect(plan("l-l1", 2)).toBe("snap");
    expect(plan("l-l1", -1)).toBe("hold");
    expect(plan(null, -1)).toBe("hold");
  });
});

describe("selection→carousel snapping", () => {
  const WIDTH = Dimensions.get("window").width;
  const INTERVAL = WIDTH - 16 * 2 - 24 + 8; // cardWidth + GAP, mirrors the component
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  test("an external selection (pin tap) snaps animated onto the card's grid offset", async () => {
    const screen = await render(
      <PinCarousel items={ITEMS} selection={null} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    await screen.rerender(
      <PinCarousel items={ITEMS} selection={{ kind: "listing", listing: SOLO }} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    expect(spy).toHaveBeenCalledWith({ offset: 1 * INTERVAL, animated: true });
  });

  test("a data reorder under the same selection realigns without animation", async () => {
    const selection = { kind: "listing", listing: SOLO } as const;
    const screen = await render(
      <PinCarousel items={ITEMS} selection={selection} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    spy.mockClear(); // mount snap (external selection) is not under test
    const reordered = [ITEMS[1], ITEMS[0]]; // the selected solo moves 1 → 0
    await screen.rerender(
      <PinCarousel items={reordered} selection={selection} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    expect(spy).toHaveBeenCalledWith({ offset: 0, animated: false });
  });

  test("selection vanishing from the results holds position (no scroll)", async () => {
    const selection = { kind: "listing", listing: SOLO } as const;
    const screen = await render(
      <PinCarousel items={ITEMS} selection={selection} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    spy.mockClear();
    await screen.rerender(
      <PinCarousel items={[ITEMS[0]]} selection={selection} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

test("the active card carries the selected state (amber border cue)", async () => {
  const selection = { kind: "listing", listing: SOLO } as const;
  const screen = await render(
    <PinCarousel items={ITEMS} selection={selection} onActive={jest.fn()} onOpen={jest.fn()} bottomInset={0} />,
  );
  expect(screen.getByLabelText("Listing: 20t Excavator").props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(screen.getByLabelText("Yard: Apapa Yard").props.accessibilityState).toMatchObject({
    selected: false,
  });
});
