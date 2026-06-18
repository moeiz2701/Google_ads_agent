-- ============================================================
-- Google Ads Agent — full schema (run once in Supabase SQL Editor)
-- Combines migrations 0001 + 0002 + 0003.
-- ============================================================

-- ============================================================================
-- 0001_core_schema — the five core objects + multi-client model + audit log.
--
-- Maps the schema-first backbone (packages/shared) to Postgres. Rich nested
-- structures (brand_kit, derived, analysis_object, ad_groups, render_spec) are
-- stored as JSONB and validated against Zod at the app boundary before write.
-- Frequently-queried fields are promoted to typed columns.
--
-- Multi-client model (§2.3): Agency (tenant) -> Client -> Campaign -> AdGroup/Ads.
-- MVP keeps tenancy light (single agency) but the model is multi-client from day 1.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- helper: auto-update updated_at ----------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- agencies (tenant) ------------------------------------------------------
create table if not exists agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_agencies_updated before update on agencies
  for each row execute function set_updated_at();

-- --- clients (client_profile, §3.4) ----------------------------------------
create table if not exists clients (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references agencies(id) on delete cascade,
  name              text not null,

  -- Tier 1 (required)
  website           text not null,
  destination_url   text not null,
  goal              text not null,           -- CampaignGoal enum (validated in app)
  budget            jsonb not null,          -- { type, amount, currency }
  geo               jsonb not null,          -- string[]

  -- Tier 2 (optional, high-leverage)
  competitors       jsonb,                   -- string[]
  usp               text,
  offer             text,
  price_positioning text,                    -- premium|mid|budget

  -- design language + Tier 3 (auto-derived, user-confirmed)
  brand_kit         jsonb,                   -- BrandKit
  derived           jsonb,                   -- { offerings, value_props, personas }

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_clients_agency on clients(agency_id);
create trigger trg_clients_updated before update on clients
  for each row execute function set_updated_at();

-- --- analyses (analysis_object, §4.4) --------------------------------------
create table if not exists analyses (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  vertical         text,
  geo              text,
  analysis         jsonb not null,           -- full AnalysisObject
  source_ad_count  integer,
  created_at       timestamptz not null default now()
);
create index if not exists idx_analyses_client on analyses(client_id);

-- --- enriched_ads (enriched_ad_record, §4.3) — the map-step corpus --------
create table if not exists enriched_ads (
  id           uuid primary key default gen_random_uuid(),
  analysis_id  uuid references analyses(id) on delete cascade,
  client_id    uuid references clients(id) on delete cascade,
  ad_id        text not null,                -- source ad id
  record       jsonb not null,               -- full EnrichedAdRecord
  created_at   timestamptz not null default now()
);
create index if not exists idx_enriched_analysis on enriched_ads(analysis_id);

-- --- campaigns (campaign_config, §6.2) -------------------------------------
create table if not exists campaigns (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  analysis_id   uuid references analyses(id) on delete set null,
  name          text not null,
  status        text not null default 'draft',  -- CampaignStatus enum
  objective     text not null,
  budget        jsonb not null,                 -- set by deterministic code only
  bid_strategy  text not null,
  networks      jsonb not null,                 -- AdNetwork[]
  flight_dates  jsonb,
  geo           jsonb not null,
  languages     jsonb,
  dayparting    jsonb,
  ad_groups     jsonb not null default '[]',    -- AdGroup[] (incl. ads/render-specs)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_campaigns_client on campaigns(client_id);
create index if not exists idx_campaigns_status on campaigns(status);
create trigger trg_campaigns_updated before update on campaigns
  for each row execute function set_updated_at();

-- --- creatives (Creative Library, §9.9) ------------------------------------
create table if not exists creatives (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  format       text not null,                  -- search|display
  spec         jsonb not null,                 -- RenderSpec
  insight_ref  text,                           -- which gap/angle it exploits
  rendered_urls jsonb,                         -- { "1200x628": url, ... }
  status       text not null default 'unused', -- unused|used|approved|rejected|launched
  created_at   timestamptz not null default now()
);
create index if not exists idx_creatives_client on creatives(client_id);

-- --- audit_log (every mutating action, CLAUDE.md supreme law) ---------------
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid references agencies(id) on delete set null,
  client_id   uuid references clients(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  actor       text,                            -- user/email or 'system'
  action      text not null,                   -- e.g. client.created, campaign.launched
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_client on audit_log(client_id);
create index if not exists idx_audit_created on audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: deferred to production multi-tenant work (§12). MVP uses the server-side
-- service-role client. When team seats/roles land, enable RLS here and switch
-- the app to an RLS-respecting per-request client.
-- ---------------------------------------------------------------------------


-- 0002_seed_agency — the single default agency for the MVP (single-tenant, §12).
-- A fixed UUID the app references until real multi-tenant auth lands.
insert into agencies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Agency')
on conflict (id) do nothing;


-- ============================================================================
-- 0003_campaign_launch — Module 5 (approval + execution) launch state.
--
-- When a campaign is launched through the deterministic execution layer
-- (§7.2), we record WHAT was created in the Google Ads (test) account and WHEN.
-- published_resources holds the LaunchResult (campaign/budget/ad-group/ad
-- resource names + warnings) so the dashboard can link back to the live objects
-- and the audit trail is complete. Never store secrets here.
-- ============================================================================

alter table campaigns
  add column if not exists published_resources jsonb,
  add column if not exists launched_at timestamptz;
