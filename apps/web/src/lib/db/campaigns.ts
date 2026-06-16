import "server-only";
import { CampaignConfig, type CampaignStatus } from "@gaa/shared";
import { getServiceClient } from "@/lib/supabase/server";

/** Persistence for campaign_config (§6.2) + lifecycle status (§9.2). */

type CampaignRow = {
  id: string;
  client_id: string;
  analysis_id: string | null;
  name: string;
  status: string;
  objective: string;
  budget: unknown;
  bid_strategy: string;
  networks: unknown;
  flight_dates: unknown;
  geo: unknown;
  languages: unknown;
  dayparting: unknown;
  ad_groups: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function rowToConfig(row: CampaignRow): CampaignConfig {
  return CampaignConfig.parse({
    campaign_id: row.id,
    client_id: row.client_id,
    name: row.name,
    status: row.status,
    objective: row.objective,
    budget: row.budget,
    bid_strategy: row.bid_strategy,
    networks: row.networks,
    flight_dates: row.flight_dates ?? null,
    geo: row.geo,
    languages: row.languages ?? null,
    dayparting: row.dayparting ?? null,
    ad_groups: row.ad_groups ?? [],
    analysis_id: row.analysis_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

/** Columns that map directly from a CampaignConfig (excludes ids/timestamps). */
function configToColumns(c: CampaignConfig) {
  return {
    name: c.name,
    status: c.status,
    objective: c.objective,
    budget: c.budget,
    bid_strategy: c.bid_strategy,
    networks: c.networks,
    flight_dates: c.flight_dates,
    geo: c.geo,
    languages: c.languages,
    dayparting: c.dayparting,
    ad_groups: c.ad_groups,
    analysis_id: c.analysis_id,
  };
}

export async function saveCampaign(config: CampaignConfig): Promise<CampaignConfig> {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .insert({ id: config.campaign_id, client_id: config.client_id, ...configToColumns(config) })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to save campaign: ${error.message}`);
  return rowToConfig(data as CampaignRow);
}

export async function listCampaigns(clientId: string): Promise<CampaignConfig[]> {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list campaigns: ${error.message}`);
  return (data as CampaignRow[]).map(rowToConfig);
}

export async function getCampaign(id: string): Promise<CampaignConfig | null> {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch campaign: ${error.message}`);
  return data ? rowToConfig(data as CampaignRow) : null;
}

/** Persist edits from the review UI (configure-by-exception). */
export async function updateCampaign(
  id: string,
  config: CampaignConfig,
): Promise<CampaignConfig> {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .update(configToColumns(config))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update campaign: ${error.message}`);
  return rowToConfig(data as CampaignRow);
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  const { error } = await getServiceClient()
    .from("campaigns")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`Failed to update status: ${error.message}`);
}

/**
 * Duplicate a campaign as a fresh Draft ("Duplicate to relaunch", §9.5). New ids
 * for the campaign and every ad group; status reset to draft.
 */
export async function duplicateCampaign(id: string): Promise<CampaignConfig> {
  const source = await getCampaign(id);
  if (!source) throw new Error("Campaign not found");
  const copy: CampaignConfig = {
    ...source,
    campaign_id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    status: "draft",
    ad_groups: source.ad_groups.map((g) => ({
      ...g,
      ad_group_id: crypto.randomUUID(),
    })),
    created_at: null,
    updated_at: null,
  };
  return saveCampaign(copy);
}
