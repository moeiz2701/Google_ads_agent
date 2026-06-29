# AI-Powered Google Ads Automation — Project Overview

**A multi-client campaign-management app that automates the front half of Google Ads for marketing agencies:** competitive research → on-brand ad generation → campaign assembly → human-approved publishing.

It's positioned as a **research-and-first-draft co-pilot**, not an "AI that knows the winning ad." The system produces informed, differentiated, policy-safe starting points *at volume*, plus a dashboard to manage them — effectiveness is then validated by real testing.

---

## What it does

1. **Onboarding** — Paste a client's website; the app scrapes it and auto-extracts a brand kit (palette, fonts, logo, tone) and offerings via an LLM, which the user confirms. Country + city targets are picked from a real geo dataset.
2. **Competitor analysis** — Discovers real competitor ads from the **Google Ads Transparency Center**, reads image-only creatives with **vision**, and distills them (map-reduce) into a compact analysis object: *winning angles ranked by ad longevity* + *strategic gap opportunities*.
3. **Generation** — Produces Search (RSA) and Display variants along deliberate strategic axes (gaps first), each tied to an insight, then critiques and policy-checks them.
4. **Rendering** — Deterministically renders Display creatives to PNGs from LLM-emitted JSON render-specs, on the client's real brand fonts/colors.
5. **Assembly & launch** — Assembles a smart-default campaign config (editable), then routes every launch through an explicit **human approval gate** to a Google Ads **test account**.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React, TypeScript (strict), Tailwind CSS |
| **App API / glue** | Next.js route handlers (Node), Zod, deterministic execution layer |
| **Creative rendering** | Satori + `@resvg/resvg-js` (JSX → SVG → PNG), Google Fonts |
| **AI service** | Python 3.12, FastAPI, LangChain, pydantic, `uv` |
| **LLM** | Provider-abstracted; Gemini default (vision + context caching) |
| **Data sources** | Transparency Center scraper, SerpApi, `country-state-city` (geo) |
| **Ads integration** | Google Ads REST API v17 (test account), Smart Bidding |
| **Storage** | Supabase (Postgres + object storage) |
| **Quality** | Vitest, Pytest, Ruff, mypy, `tsc --noEmit`, pnpm workspaces |

**Architecture:** a pnpm monorepo — `apps/web` (UI + Node glue), `services/ai` (Python analysis/generation), `packages/shared` (the schema backbone), `infra/supabase`.

---

## Engineering highlights

- **Schema-first** — Five core domain objects are defined once as Zod schemas and mirrored as pydantic models, so TypeScript and Python never drift; all external/LLM output is validated before use.
- **Provider abstraction** — Both the LLM and the Google Ads client sit behind interfaces (mock + real implementations), so swapping a vendor is a config change, not a rewrite.
- **Map-reduce over RAG** — The competitor corpus is distilled into a compact analysis object with prompt/context caching, *deliberately avoiding a vector DB* in the core flow.
- **"Longevity, not frequency"** — Winning angles are ranked by how long ads *survive* (a proven-bet proxy), not how often they appear — so a swarm of cheap, short-lived ads can't dominate the analysis.
- **Relevance funnel** — A deterministic country filter plus an LLM relevance gate strip foreign-market and off-topic noise from discovery, surfacing an actionable error instead of analyzing garbage.
- **Deterministic guardrails (non-negotiable)** — The LLM *never* sets budgets or publishes; budgets are hard-capped by code, every launch passes a human approval gate, a policy hard-gate screens ad copy, and every mutation is written to an audit log.
- **LLM fills templates, never freehands layout** — Display creatives come from parameterized templates; the LLM emits structured JSON and deterministic code renders the pixels.

---

## Scope

MVP spans all seven build modules end-to-end (onboarding → analysis → generation → rendering → assembly → dashboard → approval/execution). Publishing targets a **Google Ads test account only**; production serving is gated behind Google's approval process and intentionally out of MVP scope.
