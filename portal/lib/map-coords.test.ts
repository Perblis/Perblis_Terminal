import { describe, expect, it } from "vitest";

import { toLngLat } from "./map-coords";

describe("toLngLat", () => {
  it("accepts finite coordinates", () => {
    expect(toLngLat([3.38, 6.52])).toEqual([3.38, 6.52]);
  });

  it("rejects nullish values", () => {
    expect(toLngLat(null)).toBeNull();
    expect(toLngLat([null, 6.52] as unknown as number[])).toBeNull();
    expect(toLngLat([3.38, undefined] as unknown as number[])).toBeNull();
  });
});
