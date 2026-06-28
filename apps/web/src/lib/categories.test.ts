import { describe, expect, it } from "vitest";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_GROUPS,
  isKnownCategory,
  matchCategory,
} from "@gaa/shared";

describe("business category taxonomy", () => {
  it("has groups, each non-empty, and a non-trivial flat list", () => {
    expect(BUSINESS_CATEGORY_GROUPS.length).toBeGreaterThan(5);
    for (const g of BUSINESS_CATEGORY_GROUPS) {
      expect(g.group.trim()).not.toBe("");
      expect(g.categories.length).toBeGreaterThan(0);
    }
    // Flat list is the concatenation of all group categories.
    expect(BUSINESS_CATEGORIES).toEqual(
      BUSINESS_CATEGORY_GROUPS.flatMap((g) => g.categories),
    );
    expect(BUSINESS_CATEGORIES.length).toBeGreaterThan(50);
  });

  it("has no duplicate labels (case-insensitive)", () => {
    const lower = BUSINESS_CATEGORIES.map((c) => c.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it("isKnownCategory is case-insensitive and trims", () => {
    expect(isKnownCategory("Medical Spa")).toBe(true);
    expect(isKnownCategory("  medical spa ")).toBe(true);
    expect(isKnownCategory("totally made up vertical")).toBe(false);
  });

  it("matchCategory canonicalizes known values and rejects unknowns", () => {
    expect(matchCategory("medical spa")).toBe("Medical Spa");
    expect(matchCategory("  HVAC SERVICES ")).toBe("HVAC Services");
    expect(matchCategory("not a category")).toBeNull();
    expect(matchCategory(null)).toBeNull();
    expect(matchCategory(undefined)).toBeNull();
    expect(matchCategory("")).toBeNull();
  });
});
