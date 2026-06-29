import { NextResponse } from "next/server";
import { listCountries } from "@/lib/geo/data";

// country-state-city is a node-only dataset (kept external in next.config).
export const runtime = "nodejs";

/** GET /api/geo/countries — ISO-2 code + name for every country, sorted by name. */
export function GET() {
  return NextResponse.json(
    { countries: listCountries() },
    { headers: { "cache-control": "public, max-age=86400" } },
  );
}
