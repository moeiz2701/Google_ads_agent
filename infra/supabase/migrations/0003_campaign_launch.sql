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
