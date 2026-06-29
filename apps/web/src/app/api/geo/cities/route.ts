import { NextResponse, type NextRequest } from "next/server";
import { searchCities } from "@/lib/geo/data";

// country-state-city is a node-only dataset (kept external in next.config).
export const runtime = "nodejs";

/**
 * GET /api/geo/cities?country=US&q=los — typeahead over a country's cities.
 * Returns up to 20 deduped, region-disambiguated matches.
 */
export function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const cities = q.trim() ? searchCities(country, q, 20) : [];
  return NextResponse.json({ cities });
}
