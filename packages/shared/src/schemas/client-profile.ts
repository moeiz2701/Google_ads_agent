import { z } from "zod";
import { Budget, CampaignGoal, PricePositioning } from "./common";
import { BrandKit } from "./brand-kit";

/**
 * Client Profile (§3.4) — the per-client onboarding object.
 *
 * Three-tier input model (§3.2):
 *  - Tier 1 (required): website, goal, budget, geo, destination_url
 *  - Tier 2 (optional, high-leverage): competitors, usp, offer, price_positioning
 *  - Tier 3 (auto-derived from URL, user-confirmed): the `derived` block
 *
 * Rule (§3.2): if only one optional field is ever filled, it must be the USP.
 * That constraint is enforced in the onboarding UI/handler, not the schema.
 */

export const DerivedProfile = z.object({
  offerings: z.array(z.string()).nullable(),
  value_props: z.array(z.string()).nullable(),
  personas: z.array(z.string()).nullable(),
});
export type DerivedProfile = z.infer<typeof DerivedProfile>;

/** Geo target codes, e.g. "US-CA-LosAngeles". Free-form strings in MVP. */
const GeoTarget = z.string().min(1);

/** What gets persisted / round-trips through the API. */
export const ClientProfile = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1),

  // Tier 1 — required
  website: z.string().url(),
  destination_url: z.string().url(),
  goal: CampaignGoal,
  budget: Budget,
  geo: z.array(GeoTarget).min(1),

  /** Business category (from `categories.ts`, or a custom value). Auto-detected
   *  at onboarding and user-confirmed; drives competitor ad discovery. Nullable
   *  so legacy rows validate. */
  category: z.string().nullable(),

  /** Country (ISO-3166-1 alpha-2, from `countries.ts`). Collected at onboarding
   *  alongside the city-level `geo` targets; drives the discovery country filter
   *  (keep only same-market competitors). Nullable so legacy rows validate. */
  country: z.string().nullable(),

  // Tier 2 — optional, high-leverage
  competitors: z.array(z.string()).nullable(),
  usp: z.string().nullable(),
  offer: z.string().nullable(),
  price_positioning: PricePositioning.nullable(),

  // Design language
  brand_kit: BrandKit.nullable(),
  /** Render preference: may the Display renderer use AI-generated backgrounds
   *  (when IMAGE_GEN is configured)? Defaults true; legacy rows behave as before. */
  use_ai_backgrounds: z.boolean().default(true),

  // Tier 3 — auto-derived, user-confirmed
  derived: DerivedProfile.nullable(),

  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type ClientProfile = z.infer<typeof ClientProfile>;

/**
 * Input accepted by the onboarding handler (server generates client_id /
 * timestamps). Tier-1 required, the rest optional.
 */
export const ClientProfileInput = ClientProfile.omit({
  client_id: true,
  created_at: true,
  updated_at: true,
  // Render pref edited later via PATCH (DB default true), not at onboarding.
  use_ai_backgrounds: true,
}).extend({
  category: z.string().nullish(),
  country: z.string().nullish(),
  competitors: z.array(z.string()).nullish(),
  usp: z.string().nullish(),
  offer: z.string().nullish(),
  price_positioning: PricePositioning.nullish(),
  brand_kit: BrandKit.nullish(),
  derived: DerivedProfile.nullish(),
});
export type ClientProfileInput = z.infer<typeof ClientProfileInput>;
