# Local setup

Phase 1 (client onboarding) runs against real Supabase + Gemini. You need a
Supabase project and a Gemini API key to exercise it end-to-end; the app builds
and type-checks without them.

## 1. Install

```bash
pnpm install
```

## 2. Database

Create a Supabase project, then apply the migrations (Supabase SQL editor, or the
CLI) in order:

```
infra/supabase/migrations/0001_core_schema.sql
infra/supabase/migrations/0002_seed_agency.sql
```

`0002` seeds the single MVP agency (`00000000-0000-0000-0000-000000000001`).

## 3. Environment

```bash
cp .env.example apps/web/.env.local
```

Minimum to run onboarding:

| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server-only) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |

Google Ads + stock-image keys are not needed until later phases.

## 4. Run

```bash
pnpm dev      # http://localhost:3000
```

Flow: **/clients/new** → paste a website → **Analyze website** (auto-fills brand
kit + offerings via Gemini) → confirm/edit → **Create client** → **/clients**.

## Verify

```bash
pnpm typecheck   # all green
pnpm build       # all green
```
