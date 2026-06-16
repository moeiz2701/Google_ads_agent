/**
 * @gaa/shared — the schema-first backbone.
 *
 * The five core objects (CLAUDE.md "Schema-first") are defined here ONCE and
 * consumed by the web app, the execution layer, and (mirrored as pydantic) the
 * Python AI service. Every field is nullable so missing scraped data degrades
 * gracefully (§10). Never let TS and Python drift.
 */

export * from "./schemas/common";
export * from "./schemas/brand-kit";
export * from "./schemas/client-profile"; // 1. client_profile
export * from "./schemas/enriched-ad"; // 2. enriched_ad_record
export * from "./schemas/analysis-object"; // 3. analysis_object
export * from "./schemas/render-spec"; // 4. render_spec
export * from "./schemas/campaign-config"; // 5. campaign_config
export * from "./schemas/lifecycle";
