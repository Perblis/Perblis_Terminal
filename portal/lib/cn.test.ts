import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("merges conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("later Tailwind utilities override earlier conflicts", () => {
    expect(cn("bg-surface-card", "bg-surface-page")).toBe("bg-surface-page");
  });
});
