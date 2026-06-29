/**
 * Pure city-search filtering — separated from the `country-state-city` data
 * import so it can be unit-tested without loading the ~17MB dataset.
 *
 * The dataset has many same-named cities across regions (e.g. "Springfield"
 * appears ~20× in the US), so results are deduped by their disambiguated label
 * ("City, REGION") and prefix matches are ranked before substring matches.
 */

export interface RawCity {
  name: string;
  stateCode?: string;
}

export interface CityHit {
  name: string;
  region: string;
  /** Disambiguated, user-facing value, e.g. "Los Angeles, CA". */
  label: string;
}

export function cityLabel(name: string, region: string): string {
  return region ? `${name}, ${region}` : name;
}

export function filterCities(
  cities: RawCity[],
  query: string,
  limit = 20,
): CityHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const starts: CityHit[] = [];
  const contains: CityHit[] = [];
  for (const c of cities) {
    const idx = c.name.toLowerCase().indexOf(q);
    if (idx === -1) continue;
    const region = c.stateCode ?? "";
    const label = cityLabel(c.name, region);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    (idx === 0 ? starts : contains).push({ name: c.name, region, label });
    // Once we have a full page of strong (prefix) matches, stop scanning.
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
