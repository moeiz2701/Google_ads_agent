import "server-only";
import { City, Country } from "country-state-city";
import { type CityHit, filterCities } from "./filter";

/**
 * Server-only access to the `country-state-city` dataset. Kept off the client
 * (the dataset is ~17MB) — the browser reaches it through /api/geo/* instead.
 *
 * Each country's city list is cached on first use; the library rebuilds it from
 * the full ~150k-city dataset per call, so we don't want to pay that per request.
 */

export interface CountryOption {
  code: string; // ISO-3166-1 alpha-2
  name: string;
}

let countriesCache: CountryOption[] | null = null;
const cityCache = new Map<string, { name: string; stateCode?: string }[]>();

/** All countries, ISO-2 code + name, sorted by name. */
export function listCountries(): CountryOption[] {
  if (countriesCache) return countriesCache;
  countriesCache = Country.getAllCountries()
    .map((c) => ({ code: c.isoCode, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countriesCache;
}

/** Typeahead over a country's cities. Empty query / unknown country → []. */
export function searchCities(
  countryCode: string,
  query: string,
  limit = 20,
): CityHit[] {
  const cc = countryCode.trim().toUpperCase();
  if (!cc) return [];
  let list = cityCache.get(cc);
  if (!list) {
    list = City.getCitiesOfCountry(cc) ?? [];
    cityCache.set(cc, list);
  }
  return filterCities(list, query, limit);
}
