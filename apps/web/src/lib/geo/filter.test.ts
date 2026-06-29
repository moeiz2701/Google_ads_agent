import { describe, expect, it } from "vitest";
import { cityLabel, filterCities, type RawCity } from "./filter";

const CITIES: RawCity[] = [
  { name: "Los Angeles", stateCode: "CA" },
  { name: "Los Alamos", stateCode: "NM" },
  { name: "East Los Angeles", stateCode: "CA" },
  { name: "Springfield", stateCode: "IL" },
  { name: "Springfield", stateCode: "MO" },
  { name: "Pasadena", stateCode: "CA" },
];

describe("filterCities", () => {
  it("returns [] for an empty query", () => {
    expect(filterCities(CITIES, "   ")).toEqual([]);
  });

  it("ranks prefix matches before substring matches", () => {
    const labels = filterCities(CITIES, "los").map((h) => h.label);
    expect(labels).toContain("Los Angeles, CA");
    // "East Los Angeles" is a substring match → after the prefix matches.
    expect(labels.indexOf("East Los Angeles, CA")).toBeGreaterThan(
      labels.indexOf("Los Angeles, CA"),
    );
  });

  it("dedupes by disambiguated label, keeping distinct regions", () => {
    const labels = filterCities(CITIES, "springfield").map((h) => h.label);
    expect(labels.sort()).toEqual(["Springfield, IL", "Springfield, MO"]);
  });

  it("is case-insensitive and respects the limit", () => {
    expect(filterCities(CITIES, "PASA").map((h) => h.label)).toEqual(["Pasadena, CA"]);
    expect(filterCities(CITIES, "a", 2)).toHaveLength(2);
  });

  it("cityLabel omits an empty region", () => {
    expect(cityLabel("Tokyo", "")).toBe("Tokyo");
    expect(cityLabel("Austin", "TX")).toBe("Austin, TX");
  });
});
