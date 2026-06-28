-- 0006_client_country.sql
-- Country (ISO-3166-1 alpha-2, e.g. "US", "GB") for a client. Collected at
-- onboarding alongside the city-level geo targets. Drives the competitor-ad
-- discovery COUNTRY FILTER: the Transparency Center autocomplete returns
-- advertisers from any market, so we keep only those whose country code matches
-- this value (removes foreign-language / foreign-market noise at the source).
-- Nullable so clients predating this column validate unchanged (the AI service
-- defaults a missing value to "US").

alter table public.clients
  add column if not exists country text;
