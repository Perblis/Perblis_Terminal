// S4 snap-to-pin carousel: cards render yard summaries + listing summaries,
// swiping (viewability) selects the card's pin, tapping opens it, and the
// pin→card snap never re-fires selection (feedback-loop guard).
import { fireEvent, render } from "@testing-library/react-native";

import {
  PinCarousel,
  carouselItems,
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

test("a swipe (viewability change) activates the focused card's pin", () => {
  const onActive = jest.fn();
  const syncSource = { current: null as "pin" | "swipe" | null };
  const handler = makeViewabilityHandler(syncSource, { current: onActive });
  handler({ viewableItems: [{ item: ITEMS[1], isViewable: true, key: "l-l1", index: 1 } as never] });
  expect(onActive).toHaveBeenCalledWith(ITEMS[1]);
  expect(syncSource.current).toBe("swipe");
});

test("a pin→card snap in flight suppresses re-selection (feedback-loop guard)", () => {
  const onActive = jest.fn();
  const syncSource = { current: "pin" as "pin" | "swipe" | null };
  const handler = makeViewabilityHandler(syncSource, { current: onActive });
  handler({ viewableItems: [{ item: ITEMS[0], isViewable: true, key: "y-y1", index: 0 } as never] });
  expect(onActive).not.toHaveBeenCalled();
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
