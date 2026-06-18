import { test } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env(key: string): string {
  const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
  }
  throw new Error(`missing ${key}`);
}

const DEFAULT_AGENCY_ID = "00000000-0000-0000-0000-000000000001";

test("replicate listClientProfiles query", async () => {
  const db = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db
    .from("clients")
    .select("*")
    .eq("agency_id", DEFAULT_AGENCY_ID)
    .order("created_at", { ascending: false });
  console.log("ERROR:", JSON.stringify(error));
  console.log("ROW COUNT:", data?.length ?? "null");
  console.log("NAMES:", JSON.stringify((data ?? []).map((r: any) => r.name)));
});
