import { test } from "vitest";
import { readFileSync } from "node:fs";
import { ClientProfile } from "@gaa/shared";

function env(key: string): string {
  const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
  }
  throw new Error(`missing ${key}`);
}

test("validate every stored client row", async () => {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(
    `${url}/rest/v1/clients?select=*&order=created_at.desc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const rows = (await res.json()) as any[];
  console.log(`fetched ${rows.length} rows`);
  for (const row of rows) {
    const candidate = {
      client_id: row.id,
      name: row.name,
      website: row.website,
      destination_url: row.destination_url,
      goal: row.goal,
      budget: row.budget,
      geo: row.geo,
      category: row.category ?? null,
      country: row.country ?? null,
      competitors: row.competitors ?? null,
      usp: row.usp,
      offer: row.offer,
      price_positioning: row.price_positioning,
      brand_kit: row.brand_kit ?? null,
      derived: row.derived ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    const r = ClientProfile.safeParse(candidate);
    console.log(
      `row ${row.id} (${row.name}): ${r.success ? "OK" : "FAIL -> " + JSON.stringify(r.error.issues)}`,
    );
  }
});
