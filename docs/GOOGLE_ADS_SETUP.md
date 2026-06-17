# Google Ads API — test-account credentials (MVP)

The MVP publishes only to a **Google Ads test account**: real API calls and real
campaign objects, but **no serving, no spend, no metrics**. A developer token
with **Test Account access works immediately** — you do NOT need Basic/Standard
access (that review takes weeks and is a production concern, §11).

You need five values, which go into `apps/web/.env.local`:

| Env var | What it is |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Token from your manager account's API Center |
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 client ID (Google Cloud) |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token (one-time consent) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Your **test manager** account ID, 10 digits, no dashes |

---

## Step 1 — Create a Manager (MCC) account

1. Go to https://ads.google.com/home/tools/manager-accounts/ and create a
   **manager account** (MCC) if you don't already have one.
2. **Do NOT add billing/payment info.** An account with no billing is a *test*
   account for API purposes — exactly what the MVP uses.

## Step 2 — Get the developer token (Test Access)

1. Sign in to that **manager account**.
2. Wrench icon (Tools & Settings) → **Setup → API Center**.
   (API Center only appears on manager accounts.)
3. The first time, API Center makes you fill out an **API access application**
   (company name, website URL, contact email, intended use, accept terms). This
   is required just to be *issued* a token — it is **NOT** the weeks-long review.
   - Company name: your agency or your own name. Website: any valid URL you
     control (a portfolio/GitHub Pages/Vercel page is fine). Use case: e.g.
     "internal tool to research competitors and assemble draft Google Ads
     campaigns; testing against test accounts only."
   - After you submit, the token is granted at **Test Account access
     immediately** — no email approval needed to use it against test accounts.
   - If you see a button to **"Apply for Basic access," skip it** — that starts
     the production review (weeks); the MVP does not need it.
4. Copy the **Developer token**. Its access level will read "Test account" — that
   is all the MVP needs. → `GOOGLE_ADS_DEVELOPER_TOKEN`

## Step 3 — Create a test manager + test client account

1. Under your manager account, create a **new manager account** to serve as the
   test MCC (again, no billing). This account's 10-digit ID (strip the dashes) is
   your **login-customer-id**. → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
2. Inside that test manager, create a **new Google Ads (client) account** — this
   is where campaigns will be created. Note its customer ID too (the app passes
   it per request; you'll paste it in the UI / config when launching).
   - Tip: a Google Ads account with no payment method = a test account. It will
     never serve or spend.

## Step 4 — Google Cloud: enable the API + OAuth client

1. Open https://console.cloud.google.com/ and create (or pick) a project.
2. **APIs & Services → Library → enable "Google Ads API".**
3. **APIs & Services → OAuth consent screen**: configure it (External is fine),
   add yourself as a **Test user**, and add the scope
   `https://www.googleapis.com/auth/adwords`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Application type: Desktop app.** Download/copy:
   - Client ID → `GOOGLE_ADS_CLIENT_ID`
   - Client secret → `GOOGLE_ADS_CLIENT_SECRET`

## Step 5 — Generate a refresh token (one-time)

You authorize once as the Google user that can access the test accounts; the
resulting **refresh token** lets the server mint access tokens forever.

**Easiest (no code) — OAuth 2.0 Playground:**
1. Go to https://developers.google.com/oauthplayground/
2. Gear icon (top right) → check **"Use your own OAuth credentials"** → paste your
   client ID + secret.
3. Step 1: in the "Input your own scopes" box enter
   `https://www.googleapis.com/auth/adwords` → **Authorize APIs** → sign in with
   the account that owns the test manager → allow.
4. Step 2: **Exchange authorization code for tokens.** Copy the **Refresh token**.
   → `GOOGLE_ADS_REFRESH_TOKEN`
   - Note: for the Playground to return a refresh token, the OAuth client/consent
     screen must allow it; a Desktop-app client always does.

**Alternative (script):** the official `google-ads` Python library ships
`generate_user_credentials.py`, or any standard OAuth installed-app flow with the
`adwords` scope and `access_type=offline` works.

## Step 6 — Put them in `.env.local`

```
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890   # test manager id, no dashes
```

## Sanity check

- The developer token says **Test access** → fine for the MVP.
- `login-customer-id` is the **manager** account you authenticate *through* (10
  digits, no dashes). The **operating** customer (the test client account) is a
  separate ID supplied per request.
- If an API call returns `USER_PERMISSION_DENIED`, the authorizing Google user
  isn't linked to that customer/manager — fix the account linking, not the token.
- Test accounts return no metrics and never spend — that's expected (Module 6's
  feedback loop is therefore stubbed in the MVP).

## Apply the launch migration

Module 5 added columns. Apply `infra/supabase/migrations/0003_campaign_launch.sql`
(after 0001/0002) to your Supabase project.

## Launching (Module 5 is built)

1. Put the five values in `apps/web/.env.local` (NOT `.env.example`). Leave
   `GOOGLE_ADS_USE_MOCK` unset/false to use the real client; set it `true` to force
   the safe mock.
2. On a campaign detail page, **Approve & Launch** → the modal asks for the
   **test client account ID** (the account *under* your test manager where the
   campaign is created; dashes ok). The manager `login-customer-id` comes from env.
3. The real client creates **PAUSED** objects in the test account (no spend/serving).
   The deterministic layer enforces the budget cap and a policy pre-check first.

Note: the real REST path is implemented but unverified against a live account —
watch for v17 field-casing mismatches on the first launch and check the returned
`warnings` (Display creatives + geo targeting are deferred). Test accounts return
no metrics, so the feedback loop (Module 6) stays a stub.
