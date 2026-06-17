# CLAUDE.md — AI-Powered Google Ads Automation System

Persistent project context for Claude Code. Read this fully every session, then read the
relevant section of the implementation doc **on demand** (do not load it wholesale).

**Full spec:** `docs/IMPLEMENTATION.md` — authoritative. Section map in "Where the detail lives" below.

---

## What we're building

A **multi-client campaign-management application** (not a one-shot script) that lets marketing
**agencies** automate the front half of Google Ads for their clients: competitive research →
on-brand Search + Display ad generation → campaign assembly → human-approved publishing.

It is a **research-and-first-draft co-pilot**, not an oracle that "knows" the winning ad.
Effectiveness is validated by testing; our job is informed, fast, differentiated, policy-safe
starting points produced at volume, plus a clean dashboard to manage them.

---

## IMPORTANT — Non-negotiable rules (these are the supreme law of this project)

- **IMPORTANT: The LLM never sets or writes a budget value to a campaign.** Budgets are set and
  hard-capped by deterministic (non-LLM) code only. No exceptions.
- **IMPORTANT: No autonomous publishing.** Every launch passes through an explicit human approval
  gate. The system never publishes on its own.
- **IMPORTANT: The LLM fills templates; it never freehands ad layout.** Display creatives come from
  pre-built parameterized templates. The LLM emits a structured **render-spec (JSON)**; deterministic
  code renders the creative. The LLM does not write production layout HTML/CSS.
- **IMPORTANT: MVP publishes to a Google Ads TEST account only.** Real serving / production access is
  gated by Google approval (weeks) — out of MVP scope. Never wire production publishing in the MVP.
- **No RAG for the core generation flow.** Distill the scraped corpus into a compact analysis object
  (map-reduce), then assemble a structured prompt and use prompt/context caching. RAG is a later,
  scale-only feature (cross-client exemplar library) — do not add a vector DB now.
- **LLM access is provider-abstracted.** Always call models through the provider interface so the
  model is a config change, not a rewrite. Never hardcode a single vendor SDK across the codebase.
- **Every mutating action is logged** (audit trail) — launches, edits, pauses, budget changes.
- **Ground generation in the analysis, not just the template.** Template = look; analysis = strategy
  (winning angles + the gap). If a variant isn't tied to an insight/gap, it's not done.

---

## Tech stack (see IMPLEMENTATION.md §2.2 for rationale — confirm before swapping)

- **Frontend:** Next.js — dashboard, client workspace, campaign views, review UI, live ad previews.
- **App API / glue:** Node (NestJS or Next route handlers) — auth, multi-client data, orchestration,
  the **deterministic execution layer**, and **creative rendering** (Satori / `@vercel/og`; Puppeteer
  fallback). Rendering is JS, so it lives here, not in the Python service.
- **AI service:** Python + **LangChain / LangGraph** — scraping, analysis (vision + LLM tagging,
  aggregation), variant generation. Emits render-specs and RSA assets as JSON; renders nothing itself.
- **LLM:** provider-abstracted; default Gemini (free tier, vision, context caching) for MVP.
- **Google Ads:** official client lib (test account in MVP); Smart Bidding for optimization.
- **Storage:** Postgres (Supabase). Object storage (Supabase Storage/S3) for creatives + brand assets.
- **Competitor data:** OSS Google Ads Transparency Center scraper + SerpApi free tier fallback;
  `pytrends` for trends. (Meta Ad Library API is a production addition.)

---

## Repository structure (target)

```
/
├── CLAUDE.md
├── docs/IMPLEMENTATION.md        # full spec — read the relevant section on demand
├── apps/
│   ├── web/                      # Next.js UI (Module 7 surfaces)
│   └── api/                      # Node: auth, data, execution layer, Google Ads, Satori rendering
├── services/ai/                  # Python: analysis/ generation/ providers/  (LangChain)
├── packages/shared/              # shared schemas/types (TS) ↔ Python pydantic models
└── infra/                        # supabase, env, deploy
```

**Schema-first:** the five core objects are defined once and kept in sync across TS and Python
(`client_profile`, `enriched_ad_record`, `analysis_object`, `render_spec`, `campaign_config`).
Generate from a single source if feasible; never let the two drift. Every field nullable so
missing scraped data degrades gracefully.

---

## Where the detail lives (read on demand from docs/IMPLEMENTATION.md)

| Working on… | Read section |
|---|---|
| User input / onboarding / brand kit | §3 (Module 1) |
| Competitor scraping, enrichment, analysis object | §4 (Module 2) |
| Variant generation, render-specs, critique, rendering | §5 (Module 3) |
| Campaign assembly, smart defaults, scheduling/dayparting | §6 (Module 4) |
| Approval gate, deterministic execution, Google Ads API | §7 (Module 5) |
| Monitoring / feedback loop | §8 (Module 6) |
| Dashboard, campaign views, lifecycle, controls (UI) | §9 (Module 7) |
| Data schemas | §10 |
| Constraints & risks | §11 |
| MVP vs production scope | §12 |
| Open decisions (do not assume these) | §14 |

---

## Build phases (MVP — see IMPLEMENTATION.md §13)

- [x] 1. Data model + client onboarding (profile, brand kit, URL auto-scrape) — **done**
- [x] 2. Analysis pipeline (scrape → enrich → aggregate; pre-cache med-spa demo corpus) — **done**
- [x] 3. Generation (brief assembly → variants along axes → critique/score → render-specs) — **done**
- [x] 4. Rendering (Satori templates × standard sizes + RSA assembly; live preview) — **done**
- [x] 5. Campaign assembly (smart-default config + editable review UI) — **done**
- [x] 6. Application shell & dashboard (agency dashboard, state-grouped campaign list, detail, controls, insights) — **done**
- [x] 7. Approval + execution (deterministic layer → Google Ads test-account integration) — **done (mock-first; real path needs live test-account verification)**
- [ ] 8. Demo polish (end-to-end agency → med-spa narrative)

Phases 1–4 are the differentiated core and are demoable before publishing is wired.
**Current phase: 8 (demo polish). All 7 build modules are implemented.** The real Google Ads
publish path is built but UNVERIFIED against a live test account (see Phase 7 notes). Update the checkboxes as phases complete.

### Phase 1 — what landed (for future sessions)
- pnpm monorepo: `apps/web` (Next 14 App Router + Tailwind), `packages/shared` (Zod), `infra/supabase`.
- `packages/shared` holds the 5 core schemas as **Zod** (source-consumed via `transpilePackages`; extensionless relative imports). Mirror these as pydantic when `services/ai` lands.
- LLM provider abstraction at `apps/web/src/lib/llm` (Gemini over REST; factory keyed on `LLM_PROVIDER`). Add new providers there, never inline a vendor SDK.
- Onboarding: `POST /api/extract` (SSRF-guarded site fetch → HTML summary → LLM Tier-3 extraction) and `POST/GET /api/clients`. UI at `/clients/new`, `/clients`.
- DB: `infra/supabase/migrations/0001_core_schema.sql` (+ 0002 seed agency). RLS deferred to production; MVP uses the service-role server client. `audit_log` + `logAction()` exist — use them for every mutation.
### Phase 2 — what landed (for future sessions)
- `services/ai` Python service (uv, Python 3.12; `.venv`). Pydantic mirrors of the schemas in `gaa_ai/schemas` — keep in lockstep with `packages/shared`.
- Provider-abstracted LLM at `gaa_ai/llm` (Gemini via langchain-google-genai; `FakeLlm` for offline tests; `get_llm()` factory).
- Ad sources at `gaa_ai/scrape`: `CachedAdSource` (demo corpus in `fixtures/med_spa/ads.json`) + `LiveAdSource` (SerpApi fallback + documented Transparency-scraper seam). `get_ad_source(use_cached=...)`.
- **Map-reduce pipeline** `gaa_ai/pipeline` (built by the ml-systems-engineer agent): `enrich` (MAP) keeps performance-proxy signals deterministic, LLM does interpretation; `aggregate` (REDUCE) ranks winning angles by a **longevity** proxy (NOT frequency — deterministic baseline) and the LLM synthesizes `gap_opportunities`. `run_analysis(inp, llm=None)`. 21 offline tests, ruff+mypy clean.
- Surfaces: `POST /analyze` (FastAPI `gaa_ai.api`) + `gaa-analyze` CLI.
- Node↔AI wiring: `apps/web/src/lib/ai/client.ts` calls `/analyze`, validates against the Zod `AnalysisObject`; `POST /api/clients/:id/analyze` persists to `analyses` + audits; `/clients/:id` shows an MVP Insights view (gaps first) with a run button.
- Local Python on PATH is Anaconda 3.7 — always invoke via `uv run` (uses the 3.12 venv).

### Phase 3 — what landed (for future sessions)
- Generation in `services/ai/gaa_ai/generation` (built by the ml-systems-engineer agent): `brief` (structured, cache-friendly stable prefix + per-variant suffix; NOT RAG), `generate` (variants along deliberate axes — **gap_opportunities first**, then proven survivor angles; each `Variant` carries `axis` + `insight_ref`), `critique` (rubric + a **deterministic policy hard-gate** that can only downgrade `policy_safe`; failures regenerated ≤2× then dropped). `generate_variants(inp, llm=None)`.
- Templates are guardrails: display specs must use a `template_id` from `gaa_ai/templates.py::DISPLAY_TEMPLATES` (invalid → coerced). Display authored at 1200x628; renderer fans out in Phase 4. RSA char limits repaired before validation.
- `RenderSpec` is a discriminated union — for structured output pass the concrete per-format model (`DisplayRenderSpec`/`SearchRenderSpec`), not the union.
- Surfaces: `POST /generate` (FastAPI). 45 offline tests total, ruff+mypy clean.
- Node wiring: TS generation mirror in `packages/shared/schemas/generation.ts`; `apps/web/src/lib/ai/client.ts::generateVariants` validates the response; `POST /api/clients/:id/generate` persists to `creatives` + audits; `/clients/:id` shows a Creative Library (text previews — actual rendering is Phase 4).
- Note: `FakeLlm` returns `model_construct()` for unseeded schemas (invalid → noisy downstream validation logs); seed the exact internal model (e.g. `_CritiqueLlmScore`) in offline proofs.

### Phase 4 — what landed (for future sessions)
- Deterministic Display rendering in `apps/web/src/lib/render`: `sizes.ts` (7 standard sizes + per-size layout profiles), `palette.ts` (brand-kit colors + WCAG-legible fg + gradient fallback), `fonts.ts` (bundled Inter TTFs — Satori needs raw font bytes), `stock.ts` (Unsplash→Pexels→null with brand-color fallback; works with NO keys), `templates/` (the 4 `template_id`s as pure Satori JSX + registry; unknown id → `bold_centered`), `render.tsx`.
- **Rendering uses `satori` + `@resvg/resvg-js` directly, NOT `next/og`** — the bundled `@vercel/og` default-font loader is broken on Windows+pnpm (`ERR_INVALID_URL` on `noto-sans...ttf`). `@resvg/resvg-js` is a native addon → it MUST be in `next.config.mjs` `experimental.serverComponentsExternalPackages` or webpack mis-bundles the `.node` binary.
- One render-spec → PNG at any `DisplaySize` via `GET /api/creatives/:id/render?size=` (Node runtime). Verified at runtime: all 4 templates render valid PNGs at correct dims across billboard/rectangle/skyscraper/leaderboard/small-banner.
- UI: `DisplayPreview` (client) shows the rendered PNG with a size selector in the Creative Library; Search creatives still show as RSA text (no canvas). App-router gotcha: `_`-prefixed route folders are PRIVATE (404).
- Stock/logo remote images are best-effort; with no stock keys every creative still renders (brand gradient). Logo embedding deferred (broken remote URLs would fail Satori).

### Phase 5 — what landed (for future sessions)
- **Deterministic** campaign assembly in `apps/web/src/lib/campaign/assemble.ts` (NON-LLM): `assembleCampaign(profile, analysis, creatives)` → smart-default `CampaignConfig`. Budget copied VERBATIM from the profile (LLM never sets it). Goal→Smart-Bidding map (`bidStrategyForGoal`); ad groups themed by each creative's `insight_ref` (or analysis angles if none yet); keyword_seed distributed across groups (every seed used once); default negatives.
- Vitest added to `apps/web` (`pnpm test`; config aliases `@gaa/shared`+`@`). `assemble.test.ts` locks budget-verbatim, bid map, insight grouping, keyword distribution, schema validity (8 tests).
- DB: `lib/db/campaigns.ts` (save/list/get/update + updateStatus). API: `POST /api/clients/:id/campaigns` (assemble draft + audit), `GET/PATCH /api/campaigns/:id`. **Budget cap re-enforced server-side in PATCH** against the client profile (never trust the client).
- UI: editable configure-by-exception review at `/campaigns/:id` (`CampaignReview`): campaign settings, budget slider with visible cap, per-ad-group keyword/match-type/negatives editing, variant on/off toggles, "what will launch" summary. `AssembleButton` + campaigns list on the client page. Approval/launch is Phase 7.

### Phase 6 — what landed (for future sessions)
- **Design system = KodoAI Editorial Brutalism** (`.claude/DesignSystem.md` is authoritative; pointer in `.claude/agent-memory/frontend-stylist/STYLE.md`). Dark, zero border-radius, acid-lime accent `#c8f060` used sparingly, Barlow Condensed (display) / IBM Plex Sans (body) / IBM Plex Mono (labels with `// ` prefix) via `next/font`. Built by the frontend-stylist agent.
- Foundation: `globals.css` (`:root` KodoAI vars, dark-only), `tailwind.config.ts` (legacy token names — bg/surface/border/fg/muted/primary/danger/success — remapped to KodoAI vars + new tokens added; all border-radius = 0), `components/ui/primitives.tsx` rewritten (same export names/props; added `Badge`, `StatusBadge`, `PageHeader`, `EmptyState`, `Alert`).
- App restructured into a `(app)` route group with a shell (`components/shell/{sidebar,topbar}.tsx` + `(app)/layout.tsx`): sidebar nav Dashboard/Clients/Campaigns/Activity + topbar quick action. Old top-level pages were moved under `(app)/`.
- Screens: agency dashboard `/` (needs-attention, portfolio snapshot, recent activity), global state-grouped `/campaigns`, campaign detail `/campaigns/:id` (header `CampaignControls` gated by `canTransition` + `CampaignReview` body + Performance stub + Activity), `/activity`, plus `loading.tsx`/`error.tsx` per key route.
- Backend glue (Node, deterministic): `lib/db/dashboard.ts` (`getPortfolioSummary`/`listAllCampaigns`/`listRecentActivity`), `campaigns.duplicateCampaign`, control routes `POST /api/campaigns/:id/transition` (validates via `canTransition`) + `/duplicate`.
- DO NOT change `src/lib/render/**` fonts — those (Inter) are for generated ad creatives, separate from the brutalist app chrome.
- Note: dashboard pages need Supabase creds to populate; without them `serverEnv()` fails fast → the route's `error.tsx` shows.

### Phase 7 — what landed (for future sessions)
- **Google Ads client is provider-abstracted** (`apps/web/src/lib/google-ads/`, built by production-coder), mirroring the LLM abstraction: `GoogleAdsClient` interface + `MockGoogleAdsClient` (deterministic fake resource names, no network) + `RealGoogleAdsClient` (REST v17: cached OAuth refresh-token grant → campaignBudget→campaign[PAUSED]→adGroups→criteria→RSAs). `getGoogleAdsClient()` returns real only when all 5 `GOOGLE_ADS_*` creds present AND `GOOGLE_ADS_USE_MOCK` ≠ true, else mock.
- **Deterministic execution layer** `src/lib/execution/execute.ts::executeLaunch(config, profile, {customerId?, client?})`: validate → **enforce budget cap** (`min(config, profile.budget)` → micros; LLM never in this path) → **policy pre-check** (`policy.ts` scans enabled-ad text for banned superlatives + brand `do_not_use` → `PolicyError`) → build plan from ENABLED ads only → `client.launchCampaign`. `errors.ts` (ValidationError/PolicyError), `status.ts` (`postLaunchStatus` → scheduled if future flight else running).
- **Launch route** `POST /api/campaigns/:id/launch`: idempotency guard (only draft/pending_approval), `executeLaunch`, `markLaunched(id,status,result)` (sets status + launched_at + published_resources), audits `campaign.launched` / `campaign.launch_failed`. Takes optional `{customerId}` (operating TEST CLIENT account id; dashes stripped). login-customer-id (manager) from env.
- DB: migration `0003_campaign_launch.sql` adds `campaigns.published_resources jsonb` + `launched_at timestamptz`.
- Approval gate UI (inline, brutalist): `components/campaign/approve-launch.tsx` — "Approve & Launch" (only for draft/pending_approval) → modal restating the budget cap + enabled-variant count + a test-client-id field → POST /launch; renders 422 policy violations. Wired into the campaign-detail header; the old disabled placeholder in `campaign-controls.tsx` was removed.
- Module 6 (monitoring) = **stub** per MVP: the detail Performance section is status-aware and explains test accounts return no metrics; the feedback-loop data hooks (published_resources, launched_at, audit_log) exist. Live metrics + the longevity loop are production.
- vitest: `src/lib/execution/execute.test.ts` + `src/lib/google-ads/mock.test.ts` (25 tests total). `vitest.config.ts` aliases `server-only` to a stub so server modules import under node-env tests.
- **UNVERIFIED:** the real Google Ads REST path has not run against a live test account. Likely things to check on first real launch: exact v17 field casing (responsiveSearchAd, networkSettings, bidding strategy field for the goal), Display creatives (deferred — campaign+adgroup created, a warning is returned; responsive display ads need uploaded image assets), and geo-target criteria (not yet created — geo strings carried but not resolved to geo-constants). target_cpa/target_roas are mapped to maximize* (no target value carried).

### Phase 7 — what landed (BACKEND; for future sessions)
- **Provider-abstracted Google Ads client** at `apps/web/src/lib/google-ads/` (mirrors `lib/llm`): `types.ts` (`GoogleAdsClient` interface, `LaunchPlan`/`LaunchResult`, typed `GoogleAdsError{retryable}`), `mock.ts` (`MockGoogleAdsClient` — validates + fabricates `customers/<cid>/...mock-N` names, no network), `real.ts` (`RealGoogleAdsClient` — REST v17, OAuth refresh-token→access-token cached, mutate sequence budget→campaign→adGroups→criteria→RSA adGroupAds; **Display deferred to a warning**, not a failure), `retry.ts` (bounded backoff+jitter on retryable only), `index.ts` `getGoogleAdsClient()` → REAL only when all 5 creds present AND `GOOGLE_ADS_USE_MOCK!=true`, else MOCK (logged, no secrets). All customer ids stripped to digits.
- **Deterministic execution layer** `lib/execution/`: `execute.ts::executeLaunch(config, profile, {customerId?, client?})` enforces the supreme rules — (1) budget cap `min(config, profile)`→micros, LLM never involved; (2) `policy.ts` final pre-publish text gate on ENABLED ads (banned superlatives/punctuation/brand `do_not_use`) → `PolicyError`; (3) drops disabled variants from the plan. `status.ts::postLaunchStatus` (future start→scheduled else running). `errors.ts` (`ValidationError`/`PolicyError`).
- DB: `campaigns.markLaunched(id,status,result)` + migration `0003_campaign_launch.sql` (`published_resources jsonb`, `launched_at timestamptz`). Route `POST /api/campaigns/:id/launch` (nodejs): launchable only from draft|pending_approval (else 409), executes, marks launched, audits `campaign.launched`/`campaign.launch_failed`. Errors: PolicyError→422, ValidationError→400, GoogleAdsError→502.
- Tests: `execution/execute.test.ts` + `google-ads/mock.test.ts` (17 new, 25 total) with MockGoogleAdsClient injected — budget cap, policy block/pass, enabled-only, status helper, mock result shape. `vitest.config.ts` now aliases `server-only`→`src/test/server-only-stub.ts` so server modules import under node-env tests.
- **Real-API path is UNTESTED against a live account** (no creds in CI). The v17 mutate request/response shapes follow the docs but the user must verify against their Google Ads TEST account. Operating customer id (test CLIENT account) is supplied per-launch via the route body `customerId` (defaults to digits-of-campaign-id placeholder if omitted); `login-customer-id` (manager) comes from env.

---

## Conventions

- TypeScript strict mode; Python typed (pydantic for all schemas).
- Validate all external/LLM output against schemas before use — never trust raw LLM/scraper output.
- Wrap every LLM, scraper, render, and Google Ads call in try/catch with graceful, recoverable errors.
- Secrets via env only (Google Ads dev token, OAuth, LLM keys, Supabase). Never commit them.
- Keep modules aligned to the spec's module boundaries; don't blur analysis/generation/execution.
- Make minimal changes; do not refactor unrelated code without being asked.
- Prefer small, logically-scoped commits.

## Things NOT to do

- Do **not** let the LLM decide budget, bid amounts, or auto-publish.
- Do **not** generate ad layouts freehand or have the LLM write production creative HTML.
- Do **not** add a vector DB / RAG to the core flow.
- Do **not** wire production Google Ads publishing in the MVP.
- Do **not** present "most competitors do X" as "X works" — use the longevity proxy, and prefer the gap.
- Do **not** hardcode a single LLM vendor across the code.

---

## Commands (fill in as scaffolding lands)

```
# from repo root (pnpm workspace)
pnpm install            # install all workspaces
pnpm dev                # run the Next.js app (apps/web) on :3000
pnpm build              # build all packages (next build for web)
pnpm typecheck          # tsc --noEmit across workspaces
pnpm lint               # next lint (web)
pnpm --filter @gaa/web test   # vitest (deterministic logic, e.g. campaign assembly)

# DB: apply infra/supabase/migrations/*.sql to your Supabase project
#     (SQL editor or `supabase db push`). Run 0001 then 0002.

# env: copy .env.example -> apps/web/.env.local and fill in
#     Supabase URL/keys + GEMINI_API_KEY (minimum to run onboarding).

# ai service (Python) — from services/ai (always via uv; PATH python is 3.7)
#   uv run uvicorn gaa_ai.api:app --port 8000   # serve /analyze for the Node app
#   uv run gaa-analyze --vertical med_spa --geo "Los Angeles"   # CLI dry-run
#   uv run ruff check src tests ; uv run mypy ; uv run pytest -q
```

---

## When to ask vs proceed

For anything in **IMPLEMENTATION.md §14 (Open Decisions)** — final demo vertical, production LLM
provider, exact backend split, brand-kit auto-extraction depth, hosting, tenancy/billing — **ask
rather than assume**; these were deliberately left open. For everything else, the spec is decided;
follow it. If the spec and a request conflict, surface the conflict instead of silently picking one.