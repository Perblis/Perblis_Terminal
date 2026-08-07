import { findPressedPin, projectToPixels, type PressablePin } from "./map-press";
import type { MapYard } from "./types";

const YARD = { yard_id: "y1" } as MapYard;

function yardAt(lng: number, lat: number): PressablePin {
  return { kind: "yard", yard: YARD, lng, lat };
}

describe("projectToPixels", () => {
  it("projects the origin to the world centre", () => {
    const { x, y } = projectToPixels(0, 0, 0);
    expect(x).toBeCloseTo(256);
    expect(y).toBeCloseTo(256);
  });

  it("doubles pixel coordinates per zoom level", () => {
    const z10 = projectToPixels(3.4, 6.45, 10);
    const z11 = projectToPixels(3.4, 6.45, 11);
    expect(z11.x).toBeCloseTo(z10.x * 2);
    expect(z11.y).toBeCloseTo(z10.y * 2);
  });
});

describe("findPressedPin", () => {
  // ~0.0001° lng ≈ 1.5px at zoom 12 in Lagos; ~0.01° ≈ 150px.
  const zoom = 12;

  it("selects a pin pressed dead-on", () => {
    const pin = yardAt(3.4, 6.45);
    expect(findPressedPin([pin], { lng: 3.4, lat: 6.45 }, zoom)).toBe(pin);
  });

  it("selects a pin within the touch threshold", () => {
    const pin = yardAt(3.4, 6.45);
    expect(findPressedPin([pin], { lng: 3.4005, lat: 6.4505 }, zoom)).toBe(pin);
  });

  it("returns null for a bare-map press", () => {
    const pin = yardAt(3.4, 6.45);
    expect(findPressedPin([pin], { lng: 3.45, lat: 6.5 }, zoom)).toBeNull();
  });

  it("picks the nearest of several candidates", () => {
    const near = yardAt(3.4001, 6.45);
    const far = yardAt(3.4008, 6.45);
    expect(findPressedPin([far, near], { lng: 3.4, lat: 6.45 }, zoom)).toBe(near);
  });

  it("tightens with zoom — the same offset misses when zoomed in", () => {
    const pin = yardAt(3.4, 6.45);
    const press = { lng: 3.4005, lat: 6.4505 };
    expect(findPressedPin([pin], press, 12)).toBe(pin);
    expect(findPressedPin([pin], press, 17)).toBeNull();
  });
});
