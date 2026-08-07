import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("merges conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("later Tailwind utilities override earlier conflicts", () => {
    expect(cn("bg-surface-card", "bg-surface-page")).toBe("bg-surface-page");
  });

  // A named type role (text-body) and a semantic text colour (text-text-*) are
  // different token families that merely share the `text-` prefix. Stock
  // tailwind-merge groups them together and drops one — which shipped a
  // near-invisible label on every primary button once the ground went dark.
  describe("type roles and text colours are independent groups", () => {
    it("keeps a text colour when a later class sets the type role", () => {
      expect(cn("bg-action-primary text-text-on-brand", "text-body")).toBe(
        "bg-action-primary text-text-on-brand text-body",
      );
    });

    it("keeps a type role when a later class sets the text colour", () => {
      expect(cn("text-body-sm", "text-text-secondary")).toBe("text-body-sm text-text-secondary");
    });

    it("still overrides within the type-role group", () => {
      expect(cn("text-body", "text-body-sm")).toBe("text-body-sm");
      expect(cn("text-h1", "text-caption")).toBe("text-caption");
    });

    it("still overrides within the text-colour group", () => {
      expect(cn("text-text-primary", "text-text-danger")).toBe("text-text-danger");
      expect(cn("text-text-secondary", "text-text-on-chrome")).toBe("text-text-on-chrome");
    });
  });
});
