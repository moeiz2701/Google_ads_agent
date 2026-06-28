/**
 * Country taxonomy — the single source of truth for the onboarding country
 * picker AND the competitor-discovery country filter (so the two never drift).
 *
 * Why ISO-2 codes: the Google Ads Transparency Center autocomplete tags every
 * discovered advertiser with an ISO-3166-1 alpha-2 country code (US, TH, IT, …).
 * The discovery filter keeps only advertisers whose code matches the client's
 * country (see services/ai/src/gaa_ai/scrape/live.py), so onboarding stores the
 * SAME code. `US` is the MVP demo default.
 *
 * Curated to the common ad markets rather than the full ISO list — this is the
 * onboarding menu, not an exhaustive registry. Off-list markets can be added
 * here as needed; the stored value is a plain string, so nothing hard-breaks.
 */

export interface Country {
  code: string; // ISO-3166-1 alpha-2, uppercase
  name: string;
}

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PT", name: "Portugal" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "PL", name: "Poland" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

const NAME_BY_CODE = new Map<string, string>(
  COUNTRIES.map((c) => [c.code, c.name]),
);

/** Default discovery market for the MVP demo (and the form's initial value). */
export const DEFAULT_COUNTRY = "US";

/**
 * Resolve an ISO-2 code to its display name. Case-insensitive; unknown codes
 * echo back the upper-cased code so a custom value still renders sensibly.
 */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  return NAME_BY_CODE.get(upper) ?? upper;
}

/** Case-insensitive membership check against the curated list. */
export function isKnownCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return NAME_BY_CODE.has(code.trim().toUpperCase());
}
