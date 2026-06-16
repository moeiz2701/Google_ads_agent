# AI-Powered Google Ads Automation System — Implementation Document

**Version:** 1.0 (MVP-focused)
**Target customer:** Marketing / advertising agencies automating their ad research, creation, and campaign-setup workflow across their clients.
**Demo worked-example vertical:** Local med spas / aesthetic clinics (high Google Ads competition, visually rich for Display, classic agency client). This is a single configuration swap — any high-intent local-service vertical works (dental, legal, home services, fitness).
**Confirmed scope:** Search + Display ads. Real Google Ads **test account** integration for the demo publish step.

---

## 1. Product Definition

### 1.1 What this is

An agency-facing tool that automates the repetitive front half of running Google Ads for a client: competitive research, ad creative generation, and campaign setup. The agency onboards a client, the system mines what is working in that client's market, generates on-brand Search and Display ad variants built around the gaps competitors are missing, assembles a ready-to-launch campaign, and lets the agency review, modify, approve, and publish it.

Critically, this is a **multi-client campaign-management application, not a one-shot script** — agencies manage many clients and the full lifecycle of running, scheduled, draft, and past campaigns through a dashboard (specified in Module 7).

### 1.2 The honest value proposition

This is a **research-and-first-draft co-pilot**, not an oracle that "knows" the winning ad. No tool can guarantee ad effectiveness; effectiveness is validated by testing. The system's real job is to:

1. Collapse hours of manual ad-library research into a synthesized competitive briefing.
2. Produce on-brand, differentiated, policy-safe ad variants at volume.
3. Assemble a complete, editable campaign so the agency configures by exception instead of from a blank page.
4. Hand the platform's own optimization (and a longevity feedback loop) the job of finding actual winners.

For an agency this is throughput and consistency across many clients — that is the pain point and the sellable promise.

### 1.3 What the system explicitly does NOT do

- It does not freehand visual ad layouts from scratch (it fills proven templates).
- It does not autonomously spend money (a human approves every launch; budget is set by deterministic code, never by the LLM).
- It does not promise performance; it promises informed, fast, testable starting points.
- It does not (in MVP) optimize live bids itself — it leans on Google Smart Bidding.

---

## 2. System Architecture

### 2.1 The pipeline

```
[Client Onboarding/Input]
        │
        ▼
[Competitor & Market Analysis]  ── scrape → enrich (vision + LLM) → aggregate
        │
        ▼
[Variant Generation]  ── brief assembly → generate → critique/score → render
        │
        ▼
[Campaign Assembly]  ── smart-default config (campaign/ad groups/ads/schedule)
        │
        ▼
[Human Review & Modify]  ── configure-by-exception
        │
        ▼
[Approval Gate]  ── explicit launch action
        │
        ▼
[Deterministic Execution]  ── validate → Google Ads API (test account in MVP)
        │
        ▼
[Monitor & Feedback Loop]  ── rotate creative, pause losers, longevity → back to analysis
```

### 2.2 Tech-stack decisions (with rationale)

| Layer | Choice | Why |
|---|---|---|
| Orchestration / AI services | **Python** + LangChain / LangGraph | Best ecosystem for Google Ads client lib, scraping, vision, and agent orchestration. |
| Frontend / app | **Next.js** (your stack) | Review UI, live ad previews, campaign editor. |
| App API / glue | **NestJS or Next.js route handlers** | Auth, multi-client data, talks to the Python service. |
| LLM (reasoning + copy) | **Provider-abstracted**; default Gemini (generous free tier, native vision, context caching) for MVP; Claude/GPT swappable | Keep a thin provider interface so cost/quality is a config change, not a rewrite. |
| Vision (creative tagging) | Same multimodal LLM | One model tags scraped creatives into structured attributes. |
| Creative rendering | **Satori / `@vercel/og`** (JSX→SVG→PNG) primary; **Puppeteer/Playwright** screenshot fallback for full-CSS templates | Fast, serverless-friendly, multi-size from one spec. |
| Competitor data | Free OSS Transparency Center scraper + **SerpApi free tier** (100 credits/mo) as fallback | Zero/near-zero cost for MVP. |
| Ads platform | **Google Ads API** (test account in MVP) | Free at all tiers; test token works immediately. |
| Storage | Postgres (Supabase — your stack) | Client profiles, analysis objects, generated variants, campaign configs, audit log. |
| Object storage | Supabase Storage / S3 | Rendered creatives, logos, brand assets. |

### 2.3 Multi-client model (because the buyer is an agency)

```
Agency (tenant)
 └── Client (profile + brand kit + analysis)
      └── Campaign (config + variants)
           └── Ad Group → Ads (Search RSA / Display creatives)
```

The data model is multi-client from day one even though the MVP keeps tenancy light (see §12).

---

## 3. Module 1 — User Inputs (per client)

### 3.1 The principle

Minimize friction: the **website URL does ~70% of the work** via auto-scrape. Ask only for what genuinely improves output and cannot be derived.

### 3.2 Three-tier input model

**Tier 1 — Required (the irreducible set):**
- Client website URL (anchor; pre-fills Tier 3)
- Campaign goal (leads / calls / sales / traffic / awareness)
- Budget (daily or total)
- Geographic target (cities / regions / countries)
- Destination URL (where the click lands — conversion happens here)

**Tier 2 — High-leverage, optional (where effectiveness comes from):**
- Named competitors (3–5 names or URLs) — turns analysis from guessing into precise recon
- **The real differentiator / USP** — the single most important manual field; it cannot be scraped and powers gap-angle generation
- Current offer/promotion
- Price positioning (premium / mid / budget)

**Tier 3 — Auto-derived from URL, user confirms:**
- Offerings, brand voice/tone, brand colors, logo, value props, implied personas

If only one optional field is ever filled, force it to be the USP.

### 3.3 How the user communicates design language (the decided approach)

This is the answer to "how does the user tell the system what their ads should look like."

**MVP approach — Brand Kit:** the user provides (or the system auto-extracts from the website) a structured brand kit: logo, primary/secondary colors, fonts, and tone. The system applies this kit to a library of pre-built, proven, parameterized templates. This is the most reliable path — consistent, on-brand, never broken — and it is what produces the "looks like their brand, not AI slop" result.

```json
// brand_kit schema
{
  "logo_url": "...",
  "palette": { "primary": "#0E1B2A", "accent": "#3DDC97", "neutral": "#F5F5F5", "text": "#111" },
  "fonts": { "heading": "Poppins", "body": "Inter" },
  "tone": "clinical-reassuring",
  "do_not_use": ["before/after imagery", "price-led claims"]   // optional brand guardrails
}
```

**Production approach — Example-Ad Style Extraction (v2):** the user uploads a finished example ad (image or HTML). A one-time vision-extraction pass reverse-engineers it into a reusable style spec (layout type, slot map, palette, type treatment, imagery style), which then drives generation. This is the most flexible but most fragile path — it belongs in production, not the demo foundation.

In both cases the LLM never receives the raw asset at generation time; it receives the compact **style spec** and fills it.

### 3.4 Client profile schema

```json
{
  "client_id": "...",
  "name": "GlowSkin Med Spa",
  "website": "https://glowskinspa.com",
  "destination_url": "https://glowskinspa.com/lp/botox-offer",
  "goal": "leads",
  "budget": { "type": "daily", "amount": 50, "currency": "USD" },
  "geo": ["US-CA-LosAngeles", "US-CA-Pasadena"],
  "competitors": ["AR1782...", "skinglowla.com"],
  "usp": "only same-week board-certified injector appointments in the area",
  "offer": "free consult",
  "price_positioning": "mid",
  "brand_kit": { /* see 3.3 */ },
  "derived": { "offerings": [...], "value_props": [...], "personas": [...] }  // auto-scraped, user-confirmed
}
```

---

## 4. Module 2 — Competitor & Market Analysis

### 4.1 Data sources

- **Primary (Google):** Google Ads Transparency Center via a scraper (no official API). Free OSS scraper primary; SerpApi free tier as fallback. Search by competitor domain / advertiser ID.
- **Recommended addition for Display design intelligence:** Meta Ad Library (official free API, richer creative corpus) — Google Search ads carry almost no "design," so design-language signal lives more on Display/Meta.
- **Market trends:** Google Trends via `pytrends` (free).

### 4.2 The pipeline (map-reduce, not RAG)

1. **Scrape** a corpus of competitor ads (50–200 per niche).
2. **Enrich each ad** (map step): run text through the LLM and creatives through the vision model to produce a structured per-ad record.
3. **Aggregate once** (reduce step): synthesize the corpus into a single compact analysis object — the cross-ad patterns, weighted by longevity. This pre-aggregation is why you do **not** need RAG (see §6.3).

### 4.3 Parameters extracted (organized by purpose)

- **Performance-proxy signals (most valuable, all derived):** `days_running` (last_shown − first_shown — your best free proxy for "is it working"), `still_active`, `variant_count` (conviction/budget signal), `scale_tier` (from impression bucket × region spread). Only emulate longevity-survivors; ignore short-lived noise.
- **Offer & pricing:** offer type, price points, promotion cadence.
- **Messaging & angle:** primary value prop, emotional hook, implied persona, claims, CTA verb.
- **Keyword & targeting:** repeated phrases → keyword seed list; regions; platforms (Search/Display/YouTube).
- **Creative / design language (Display only):** faces, before/after, product vs lifestyle, text density, tone, dominant colors, format mix.

> **Reliability note:** text/format/dates are solid; impression ranges are wide buckets (tier signal only, never precise); landing-page detail needs a second fetch and must degrade gracefully when missing.

### 4.4 Output — the distilled analysis object

```json
{
  "vertical": "med_spa",
  "geo": "Los Angeles",
  "winning_angles": [
    { "angle": "price + accessibility", "longevity_weight": 0.81, "example_ids": [...] },
    { "angle": "board-certified trust", "longevity_weight": 0.64 }
  ],
  "saturated_angles": ["generic 'glow up'", "discount %"],
  "gap_opportunities": ["same-week availability nobody advertises", "male clientele unaddressed"],
  "common_offers": ["free consult", "first-session discount"],
  "cta_patterns": ["Book", "Schedule"],
  "keyword_seed": ["botox los angeles", "med spa near me", "affordable filler"],
  "creative_norms": { "faces": 0.7, "before_after": 0.3, "text_density": "low" },
  "persona": "price-aware first-timer, 28–45"
}
```

The **gap_opportunities** field is the strategic payload — generation is built around exploiting these, not copying the crowd.

---

## 5. Module 3 — Variant Generation

### 5.1 Core principle: templates as guardrails

The AI generates **content and assembly**, never freehand layout. Layout quality is baked into human-built templates; the AI writes copy, selects template + palette per the brand kit and analysis, and fills slots.

### 5.2 The mechanism: LLM → render-spec → deterministic renderer

The LLM outputs a structured render-spec; deterministic code renders the actual creative.

```json
// render-spec the LLM emits (Display)
{
  "template_id": "split_image_left",
  "size": "1200x628",
  "headline": "Same-Week Botox, Done Right",
  "subhead": "Board-certified injectors. Free consult.",
  "cta": "Book Free Consult",
  "palette_ref": "brand_kit.primary",
  "image": { "source": "stock_or_client", "query": "clean modern treatment room" },
  "angle": "gap:trust+speed"
}
```

```jsx
// deterministic template — design is fixed, only content varies
function SplitImageLeft({ spec, brandKit }) { /* renders to SVG via Satori → PNG */ }
```

For **Search** ads the "spec" is just structured text — Responsive Search Ad assets (15 headlines / 4 descriptions max, with pinning rules) — no canvas needed.

### 5.3 Feeding the data: structured assembly + caching (NOT RAG)

The brief is assembled as one structured, clearly-delimited prompt:

```
<client_context>   profile + brand kit + USP </client_context>
<market_analysis>  distilled analysis object incl. gap_opportunities </market_analysis>
<style_spec>       brand-kit-derived template/style spec </style_spec>
<task>             generate N variants as render-specs; output schema: {...} </task>
```

Because the analysis is pre-distilled, the entire brief is a few thousand tokens — include it whole every call. **Prompt/context caching** makes generating many variants cheap: the client/analysis/style sections are identical across all N generations, so cache that stable prefix and vary only the per-variant instruction.

### 5.4 Generation along deliberate axes

Generate variants by varying one dimension at a time — proven angle vs gap angle, hook, CTA, visual treatment — producing a legible test matrix ("here are three strategic directions") rather than ten random ads.

### 5.5 Critique / scoring pass

A second LLM pass scores each variant before rendering against a rubric:
- Single clear message
- CTA strength
- Differentiation from the competitor set
- **Google ad-policy safety** (banned superlatives, trademark, clickbait)

Failures are regenerated. This catches disapproval-bait before publish.

### 5.6 Rendering pipeline

- **Search:** assemble RSA assets directly (no rendering).
- **Display:** one render-spec fans out to all standard Google sizes (300×250, 336×280, 728×90, 160×600, 320×50, 300×600, 1200×628) via parameterized templates.
- **Images:** MVP uses free stock (Unsplash/Pexels APIs) + client-supplied product photos. AI image generation is deferred (quality/brand/policy risk).

---

## 6. Module 4 — Campaign Assembly & Configuration

### 6.1 Principle: smart defaults + configure-by-exception

The system generates a **complete, launch-ready campaign** with every setting pre-filled from the analysis, presented for review with everything editable inline. This beats a blank-form builder: non-expert users aren't paralyzed, the product's value (knowing good defaults) is on display, and editing-by-exception is fast.

### 6.2 Generated campaign structure (all editable)

- **Campaign level:** objective, budget, **bid strategy** (recommend Google Smart Bidding aligned to goal — e.g., Maximize Conversions / Target CPA), networks (Search + Display), flight dates, geo, languages.
- **Ad group level:** themed ad groups clustering related keywords/angles, keywords per group with match types (seeded from analysis), negative keywords.
- **Ad level:** generated variants mapped into the right ad groups, multiple per group for testing.

### 6.3 Scheduling reality (model correction)

Google Ads is **not** "scheduled posts" like social. Campaigns run continuously within budget and the platform auto-paces spend. "Scheduling" here means three things:
1. **Flight dates** (start/end)
2. **Ad scheduling / dayparting** (eligible days/hours — e.g., booking hours only)
3. **Creative rotation** (when fresh variants rotate in / losers pause)

(If a Meta/social channel is added later, *that* is where discrete scheduled posts and a creative calendar apply — separate channel module.)

---

## 7. Module 5 — Approval, Publishing & Execution

### 7.1 The approval gate (mandatory)

No autonomous publishing. The user reviews the full draft, edits by exception, toggles which variants go live, then clicks **Approve & Launch**. This is both protective (bad spend / disapprovals) and necessary (production publishing requires Google approval — see §11).

### 7.2 Deterministic execution layer

On approval, deterministic (non-LLM) code:
1. Validates the config and **enforces budget caps** (the LLM never writes a budget number to a live campaign).
2. Runs a policy pre-check.
3. Creates the campaign objects via the Google Ads API.

### 7.3 Google Ads API integration (MVP = test account)

- Credentials: developer token (Test Access — immediate), OAuth client ID/secret, refresh token, login-customer-id.
- MVP publishes to a **Google Ads test manager account**: real API calls, real campaign objects created, **but no real serving and no real spend or metrics** — perfect for a credible demo at zero cost.
- Demo narrative: agency onboards a med-spa client → system researches → generates Search + Display variants → assembles campaign → agency tweaks → approves → objects appear in the test account via the API.

---

## 8. Module 6 — Monitoring & Feedback Loop

- Post-launch: monitor performance, rotate creative on schedule, pause underperformers.
- **The moat:** feed realized performance/longevity of *your own* generated variants back into the analysis layer, so the system learns which angles survive in each vertical and improves future generation. This turns a one-shot tool into a compounding, retained product.
- (In MVP this loop is stubbed — test accounts have no real metrics — but the data model and hooks should exist from the start.)

---

## 9. Module 7 — Application & Dashboard (the agency UX layer)

This is **not just a bot with a "Launch" button — it is a multi-client campaign-management application.** Modules 1–6 are the engine; this module is the product surface where an agency actually works: managing many clients, watching live campaigns, picking up drafts, and reaching back into past results.

### 9.1 Information architecture (navigation)

```
Agency Dashboard (cross-client overview)
 ├── Clients
 │    └── Client Workspace
 │         ├── Campaigns        (Running / Scheduled / Drafts / Past / Archived)
 │         │    └── Campaign Detail
 │         ├── Insights         (the competitive analysis, visualized)
 │         ├── Creative Library (all generated variants for this client)
 │         └── Brand Kit        (logo, palette, fonts, tone)
 ├── Notifications  (approvals pending, campaigns ending, disapprovals)
 ├── Activity / Audit log
 └── Settings  (team, billing — production)
```

### 9.2 Campaign lifecycle (the spine of every view)

Every campaign moves through explicit states; each state determines what is shown and what the user can do:

`Draft → Pending Approval → Scheduled → Running → Paused → Completed → Archived`

- **Draft** — generated/edited but not launched (your "stored campaigns")
- **Pending Approval** — awaiting the human gate
- **Scheduled** — approved, start date in the future
- **Running** — live in the (test) account
- **Paused** — temporarily stopped, resumable
- **Completed** — past its flight dates
- **Archived** — hidden from default views, retrievable

### 9.3 Agency Dashboard (the home screen)

The cross-client command center:
- **Needs attention:** campaigns Pending Approval, ending soon, paused, or disapproved — the agency's daily to-do list.
- **Portfolio snapshot:** counts by status across all clients (Running / Scheduled / Drafts); in production, aggregate spend and performance KPIs.
- **Recent activity:** who changed or launched what.
- **Quick actions:** + New Client, + New Campaign.

### 9.4 Client Workspace

Per-client hub with a header (brand, goal, budget, destination) and tabs: **Campaigns | Insights | Creative Library | Brand Kit | Settings**. The campaign list here is scoped to this client.

### 9.5 How running / past / stored campaigns are displayed (the direct answer)

A single **Campaigns** view, filterable and grouped by lifecycle state, is how the user sees everything in one mental model:

- **List view** — table or cards showing: status badge, client, format (Search/Display), flight dates, budget (spent / total), and a quick-actions menu. Filters: status, client, format, date range. Search by name.
- **Running** — live badge, budget-pacing bar, performance snapshot (production), active variant thumbnails, inline controls (Pause, Edit budget, Open).
- **Scheduled** — countdown to start; fully editable until launch.
- **Drafts (stored)** — "Resume" back into the editor; generated-but-unlaunched campaigns the agency can pick up anytime.
- **Past / Completed** — read-only summary with final results (production), plus **"Duplicate to relaunch"** so a winner becomes next month's starting point.
- **Archived** — collapsed by default, one click to restore.

This state-grouped list is the concrete answer to "show running, past, and stored campaigns effectively": one screen, filtered by where each campaign sits in its life.

### 9.6 Campaign Detail view

Header shows status + controls (Pause/Resume, Edit, Duplicate, Archive). Sections:
- **Overview** — config summary (objective, budget, bid strategy, geo, schedule).
- **Creatives** — the variant gallery: Search RSAs as preview cards, Display creatives shown at actual sizes, each with an active/paused toggle.
- **Targeting & Keywords** — ad groups, keywords + match types, negatives; all editable.
- **Schedule** — flight dates + dayparting grid + rotation rules.
- **Performance** — metrics (production; stubbed on test accounts).
- **Activity log** — every change and who made it (trust + multi-seat accountability).

### 9.7 The Review & Approval screen (configure-by-exception in practice)

Where a Draft becomes Live:
- The full generated campaign, every field editable inline (budget slider with the hard cap visible, editable headlines, add/remove keywords, adjust geo/schedule).
- A **variant gallery with on/off toggles** — the agency curates which ads launch.
- A **"What will launch" summary** (a diff of defaults vs edits) so nothing is a surprise.
- **Approve & Launch** → confirmation modal restating the budget cap → the deterministic execution layer fires.

### 9.8 Insights view (making the research visible — a selling point)

The competitive analysis is presented, not hidden: winning angles (longevity-weighted), saturated vs **gap** angles, competitor offers, creative norms, and the keyword landscape. Crucially, **each generated variant links back to the insight or gap it exploits** ("this ad targets the same-week-availability gap no competitor advertises"). For an agency demoing value to *their* client, this "why these ads" traceability is the trust-builder.

### 9.9 Creative Library

All variants ever generated for a client, reusable across campaigns, tagged by status (used / unused, approved / rejected, launched) — a reusable creative bank per client.

### 9.10 Control affordances (what the user can do)

Pause/resume a campaign; edit budget within the hard cap; add/remove/edit keywords and negatives; toggle individual variants on/off; adjust schedule and dayparting; duplicate; archive/restore; regenerate variants; re-run competitor analysis. All mutating actions are logged.

### 9.11 System states to design for

- **Loading/progress** — analysis and generation take seconds to a minute; show staged progress ("Scraping competitors → Analyzing → Generating → Rendering"), not a blank spinner.
- **Empty** — no clients/campaigns yet → guided "add your first client" flow.
- **Error** — scrape failed, API auth expired, policy rejection → clear, recoverable messaging.

### 9.12 MVP vs production for the UX

- **MVP:** every screen above against test-account data — the full lifecycle and statuses are real, performance metrics stubbed/mock, single agency, simple auth. Demo-critical screens: Agency Dashboard, state-grouped Campaigns list, Campaign Detail, Review/Approval, Insights.
- **Production:** real performance dashboards and charts, multi-tenant with team seats and role-based access, notifications, white-label theming, billing.

---

## 10. Consolidated Data Schemas

The five core objects, all defined above:
1. `client_profile` (§3.4) — includes `brand_kit` (§3.3)
2. `enriched_ad_record` (per-ad, map step) (§4.3)
3. `analysis_object` (aggregated) (§4.4)
4. `render_spec` (per variant) (§5.2)
5. `campaign_config` (§6.2)

Design every field nullable so missing scraped data degrades gracefully.

---

## 11. Critical Constraints & Risks

| Constraint | Impact | Mitigation |
|---|---|---|
| **Google Ads API production access** | Test token works instantly; production needs Basic Access (review measured in weeks; backlog as of 2026) and a full-service auto-campaign tool triggers Required Minimum Functionality audits under Standard Access. | MVP stays on test accounts. Apply for Basic Access early in parallel. Frame "go-live needs Google approval" honestly to clients. |
| **Ad policy review** | Every ad is reviewed; LLM copy frequently trips policy. | Critique/scoring pass (§5.5) + human approval gate. |
| **Budget safety** | A bug or hallucinated number could overspend. | Deterministic budget layer with hard caps; LLM never sets spend. |
| **Competitor data sourcing** | No official Google API; scrapers can break; impression data is coarse. | OSS scraper + SerpApi fallback; treat impression ranges as tiers; cache demo data. |
| **"Sees what runs, not what works"** | Running ≠ effective. | Longevity weighting as performance proxy; never present "most competitors do X" as "X works." |
| **Sameness risk** | Copying competitors produces average ads. | Gap-opportunity generation; differentiate, don't mimic. |

---

## 12. MVP Demo Scope vs Production Build

| Area | MVP Demo (priority) | Production |
|---|---|---|
| **Ad formats** | Search + Display, both functional | + Video/YouTube, responsive Display variations, Performance Max |
| **Publishing** | Real **test account** (no real spend/serving) | Production accounts after Basic/Standard Access approval + RMF compliance |
| **Tenancy** | Single agency, multiple client "projects"; light auth | Full multi-tenant SaaS: team seats, roles, white-label, billing |
| **Dashboard / app shell** | Agency dashboard + state-grouped campaign list + detail + review/approval + insights, on test data | Real-metric dashboards & charts, notifications, white-label theming |
| **Campaign control** | Pause/resume, edit within caps, toggle variants, duplicate, archive, activity log | + bulk actions, scheduled rules, role-based permissions, alerts |
| **Design-language input** | **Brand kit** applied to template library | + Example-ad style extraction (vision reverse-engineering) |
| **Competitor data** | Pre-cached corpus for the demo vertical (med spa) + on-demand scrape; OSS scraper + SerpApi free | Robust scraping infra, proxy rotation, Meta Ad Library API, scheduled refresh, caching layer |
| **Images** | Free stock + client uploads | + AI image generation with brand/policy controls |
| **LLM** | Provider-abstracted; Gemini free tier; prompt caching | Cost-optimized routing, fine-tuned prompts per vertical, evals |
| **Feedback loop** | Stubbed (no real metrics on test accounts) | Live performance ingestion → analysis improvement (the moat) |
| **Optimization** | Recommend Smart Bidding; no custom logic | Optional custom rules, automated A/B promotion, budget pacing controls |
| **Templates** | 3–5 hand-built per format/size | Large library, per-vertical template sets, designer tooling |
| **RAG** | None (distilled context + caching) | Optional: cross-client high-performing-ad **exemplar library** retrieval; large-brand knowledge base |

---

## 13. Suggested Build Sequence (MVP)

1. **Data model + client onboarding** (profile, brand kit, URL auto-scrape).
2. **Analysis pipeline** — scraper → enrich (vision/LLM) → aggregate → analysis object. Pre-cache the med-spa corpus so the demo always works.
3. **Generation** — brief assembly → variant generation (axes) → critique/score → render-specs.
4. **Rendering** — Satori templates (3–5 layouts × standard sizes) + RSA assembly for Search; live preview in Next.js.
5. **Campaign assembly** — smart-default config + editable review UI.
6. **Application shell & dashboard** — agency dashboard, state-grouped campaign list, campaign detail, lifecycle states, and control affordances (pause / edit / duplicate / archive); the Insights view.
7. **Approval + execution** — deterministic layer → Google Ads test-account API integration.
8. **Demo polish** — the end-to-end agency → med-spa narrative.

Build 1–4 first (the differentiated core, demoable even before publishing is wired); 5–6 make it feel like a product, not a script; 7 wires the test-account publishing.

---

## 14. Open Decisions To Confirm (not assumed)

These are genuinely open and should be decided before/early in the build:

1. **Final demo client vertical** — defaulted to local med spa with rationale; confirm or swap (dental, legal, home services, fitness are equally strong).
2. **LLM provider for production** — MVP uses Gemini free tier; confirm production provider once cost/quality is benchmarked. (Provider abstraction makes this low-risk.)
3. **Backend split** — proposed Python AI service + Next.js/NestJS app; confirm whether you want a single Python-heavy backend or the hybrid.
4. **Brand-kit auto-extraction depth** — how much to auto-pull from the website vs require manual entry in MVP.
5. **Demo hosting** — local vs deployed (affects whether clients can self-serve the demo).
6. **Production tenancy/billing model** — out of MVP scope, but the data model should anticipate it (it currently does).
