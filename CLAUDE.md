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
- [ ] 2. Analysis pipeline (scrape → enrich → aggregate; pre-cache med-spa demo corpus)
- [ ] 3. Generation (brief assembly → variants along axes → critique/score → render-specs)
- [ ] 4. Rendering (Satori templates × standard sizes + RSA assembly; live preview)
- [ ] 5. Campaign assembly (smart-default config + editable review UI)
- [ ] 6. Application shell & dashboard (agency dashboard, state-grouped campaign list, detail, controls, insights)
- [ ] 7. Approval + execution (deterministic layer → Google Ads test-account integration)
- [ ] 8. Demo polish (end-to-end agency → med-spa narrative)

Phases 1–4 are the differentiated core and are demoable before publishing is wired.
**Current phase: 2 (analysis pipeline).** Update the checkboxes as phases complete.

### Phase 1 — what landed (for future sessions)
- pnpm monorepo: `apps/web` (Next 14 App Router + Tailwind), `packages/shared` (Zod), `infra/supabase`.
- `packages/shared` holds the 5 core schemas as **Zod** (source-consumed via `transpilePackages`; extensionless relative imports). Mirror these as pydantic when `services/ai` lands.
- LLM provider abstraction at `apps/web/src/lib/llm` (Gemini over REST; factory keyed on `LLM_PROVIDER`). Add new providers there, never inline a vendor SDK.
- Onboarding: `POST /api/extract` (SSRF-guarded site fetch → HTML summary → LLM Tier-3 extraction) and `POST/GET /api/clients`. UI at `/clients/new`, `/clients`.
- DB: `infra/supabase/migrations/0001_core_schema.sql` (+ 0002 seed agency). RLS deferred to production; MVP uses the service-role server client. `audit_log` + `logAction()` exist — use them for every mutation.
- `services/ai` (Python) is **not** scaffolded yet and local Python is 3.7.3 — needs 3.9+ before Phase 2 work that uses LangChain.

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

# DB: apply infra/supabase/migrations/*.sql to your Supabase project
#     (SQL editor or `supabase db push`). Run 0001 then 0002.

# env: copy .env.example -> apps/web/.env.local and fill in
#     Supabase URL/keys + GEMINI_API_KEY (minimum to run onboarding).

# ai service (Python) — not scaffolded yet (Phase 2; needs Python 3.9+)
```

---

## When to ask vs proceed

For anything in **IMPLEMENTATION.md §14 (Open Decisions)** — final demo vertical, production LLM
provider, exact backend split, brand-kit auto-extraction depth, hosting, tenancy/billing — **ask
rather than assume**; these were deliberately left open. For everything else, the spec is decided;
follow it. If the spec and a request conflict, surface the conflict instead of silently picking one.