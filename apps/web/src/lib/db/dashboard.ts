import "server-only";
import type { AdNetwork, Budget, CampaignStatus, FlightDates } from "@gaa/shared";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_AGENCY_ID } from "./constants";

/**
 * Cross-client aggregation for the agency dashboard (§9.3) and the global
 * state-grouped campaign list (§9.5). Read-only summaries — cheap projections,
 * not full CampaignConfig parses.
 */

export interface CampaignSummary {
  campaign_id: string;
  client_id: string;
  client_name: string;
  name: string;
  status: CampaignStatus;
  objective: string;
  budget: Budget;
  networks: AdNetwork[];
  flight_dates: FlightDates | null;
  ad_group_count: number;
  ad_count: number;
  enabled_ad_count: number;
  updated_at: string | null;
}

type Row = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  objective: string;
  budget: Budget;
  networks: AdNetwork[];
  flight_dates: FlightDates | null;
  ad_groups: Array<{ ads?: Array<{ enabled?: boolean }> }> | null;
  updated_at: string | null;
  client: { name: string } | { name: string }[] | null;
};

function rowToSummary(r: Row): CampaignSummary {
  const groups = r.ad_groups ?? [];
  const ads = groups.flatMap((g) => g.ads ?? []);
  const clientRel = Array.isArray(r.client) ? r.client[0] : r.client;
  return {
    campaign_id: r.id,
    client_id: r.client_id,
    client_name: clientRel?.name ?? "Unknown client",
    name: r.name,
    status: r.status as CampaignStatus,
    objective: r.objective,
    budget: r.budget,
    networks: r.networks ?? [],
    flight_dates: r.flight_dates,
    ad_group_count: groups.length,
    ad_count: ads.length,
    enabled_ad_count: ads.filter((a) => a.enabled !== false).length,
    updated_at: r.updated_at,
  };
}

export async function listAllCampaigns(): Promise<CampaignSummary[]> {
  const { data, error } = await getServiceClient()
    .from("campaigns")
    .select(
      "id, client_id, name, status, objective, budget, networks, flight_dates, ad_groups, updated_at, client:clients(name)",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to list campaigns: ${error.message}`);
  return (data as Row[]).map(rowToSummary);
}

export interface ActivityEntry {
  id: string;
  action: string;
  actor: string | null;
  client_id: string | null;
  campaign_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function listRecentActivity(limit = 12): Promise<ActivityEntry[]> {
  const { data, error } = await getServiceClient()
    .from("audit_log")
    .select("id, action, actor, client_id, campaign_id, details, created_at")
    .eq("agency_id", DEFAULT_AGENCY_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load activity: ${error.message}`);
  return (data ?? []) as ActivityEntry[];
}

export interface PortfolioSummary {
  totalClients: number;
  totalCampaigns: number;
  byStatus: Record<CampaignStatus, number>;
  /** campaigns the agency must act on (pending approval, paused) — the to-do list. */
  needsAttention: CampaignSummary[];
}

const ZERO_STATUS: Record<CampaignStatus, number> = {
  draft: 0,
  pending_approval: 0,
  scheduled: 0,
  running: 0,
  paused: 0,
  completed: 0,
  archived: 0,
};

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const db = getServiceClient();
  const [{ count: clientCount }, campaigns] = await Promise.all([
    db
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", DEFAULT_AGENCY_ID),
    listAllCampaigns(),
  ]);

  const byStatus = { ...ZERO_STATUS };
  for (const c of campaigns) byStatus[c.status] += 1;

  const needsAttention = campaigns.filter(
    (c) => c.status === "pending_approval" || c.status === "paused",
  );

  return {
    totalClients: clientCount ?? 0,
    totalCampaigns: campaigns.length,
    byStatus,
    needsAttention,
  };
}
