-- 0004_client_render_prefs.sql
-- Per-client render preference: whether the Display renderer may use AI-generated
-- backgrounds (when IMAGE_GEN is configured). Default true → clients predating this
-- column behave exactly as before. Read by the render path; not part of ClientProfile.

alter table public.clients
  add column if not exists use_ai_backgrounds boolean not null default true;
