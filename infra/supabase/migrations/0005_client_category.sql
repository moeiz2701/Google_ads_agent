-- 0005_client_category.sql
-- Business category for a client (e.g. "Medical Spa", "HVAC Services"), auto-detected
-- at onboarding from the website and user-confirmed. Drives competitor ad discovery
-- (the Transparency Center autocomplete matches advertiser names, so a clean category
-- label yields far more relevant competitors than a slugified single offering).
-- Nullable so clients predating this column validate unchanged. May hold a custom
-- (off-taxonomy) value entered via the onboarding "Other…" path.

alter table public.clients
  add column if not exists category text;
