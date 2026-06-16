import "server-only";
import {
  ClientProfile,
  type ClientProfileInput,
  emptyBrandKit,
} from "@gaa/shared";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_AGENCY_ID } from "./constants";

/**
 * Client repository — maps the `clients` table ⇄ ClientProfile. Every read is
 * re-validated against the Zod schema so a malformed row never propagates.
 */

type ClientRow = {
  id: string;
  name: string;
  website: string;
  destination_url: string;
  goal: string;
  budget: unknown;
  geo: unknown;
  competitors: unknown;
  usp: string | null;
  offer: string | null;
  price_positioning: string | null;
  brand_kit: unknown;
  derived: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function rowToProfile(row: ClientRow): ClientProfile {
  return ClientProfile.parse({
    client_id: row.id,
    name: row.name,
    website: row.website,
    destination_url: row.destination_url,
    goal: row.goal,
    budget: row.budget,
    geo: row.geo,
    competitors: row.competitors ?? null,
    usp: row.usp,
    offer: row.offer,
    price_positioning: row.price_positioning,
    brand_kit: row.brand_kit ?? null,
    derived: row.derived ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function createClientProfile(
  input: ClientProfileInput,
): Promise<ClientProfile> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("clients")
    .insert({
      agency_id: DEFAULT_AGENCY_ID,
      name: input.name,
      website: input.website,
      destination_url: input.destination_url,
      goal: input.goal,
      budget: input.budget,
      geo: input.geo,
      competitors: input.competitors ?? null,
      usp: input.usp ?? null,
      offer: input.offer ?? null,
      price_positioning: input.price_positioning ?? null,
      brand_kit: input.brand_kit ?? emptyBrandKit(),
      derived: input.derived ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create client: ${error.message}`);
  return rowToProfile(data as ClientRow);
}

export async function listClientProfiles(): Promise<ClientProfile[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("clients")
    .select("*")
    .eq("agency_id", DEFAULT_AGENCY_ID)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list clients: ${error.message}`);
  return (data as ClientRow[]).map(rowToProfile);
}

export async function getClientProfile(
  id: string,
): Promise<ClientProfile | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch client: ${error.message}`);
  return data ? rowToProfile(data as ClientRow) : null;
}
