import { describe, expect, it } from "vitest";
import { COUNTRIES, DEFAULT_COUNTRY, countryName, isKnownCountry } from "@gaa/shared";

describe("country taxonomy", () => {
  it("has a non-trivial list with US as the default", () => {
    expect(COUNTRIES.length).toBeGreaterThan(10);
    expect(DEFAULT_COUNTRY).toBe("US");
    expect(COUNTRIES.some((c) => c.code === DEFAULT_COUNTRY)).toBe(true);
  });

  it("uses uppercase ISO-2 codes with no duplicates", () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.trim()).not.toBe("");
    }
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("countryName resolves codes case-insensitively and echoes unknowns", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("  gb ")).toBe("United Kingdom");
    expect(countryName("zz")).toBe("ZZ"); // unknown -> upper-cased code
    expect(countryName(null)).toBe("");
    expect(countryName(undefined)).toBe("");
  });

  it("isKnownCountry is case-insensitive and trims", () => {
    expect(isKnownCountry("us")).toBe(true);
    expect(isKnownCountry("  TH ")).toBe(false); // not in the curated list
    expect(isKnownCountry("GB")).toBe(true);
    expect(isKnownCountry(null)).toBe(false);
    expect(isKnownCountry("")).toBe(false);
  });
});
