# Project Tracker: Emergent Cloud → Vercel + Render + MongoDB Atlas Migration

> **Last updated:** 2026-02-22 (Session 2 — Deployment Phase)
> **Purpose:** Resume point if token/session runs out. Each task has a status so the next session picks up exactly where we left off.

---

## Phase 1: Backend — Replace Emergent Dependencies

### 1.1 Update `backend/requirements.txt`
- **Status:** DONE ✅ VERIFIED
- **What was done:** Simplified to 13 top-level deps with flexible version ranges (was 126 pinned packages). Removed `emergentintegrations` and all unused heavy packages. Let pip resolve transitive deps to avoid version conflicts.
- **Final deps:** `fastapi`, `uvicorn`, `motor`, `pymongo`, `pydantic[email]`, `PyJWT`, `passlib[bcrypt]`, `python-dotenv`, `python-multipart`, `google-generativeai`, `groq`, `stripe`, `httpx`
- **Build fix applied:** Originally had exact pinned versions that conflicted on Python 3.14 (grpcio-status vs google-api-core). Switched to flexible ranges + pinned Python 3.11.6.

### 1.2 Replace LLM Integration in `backend/server.py`
- **Status:** DONE ✅ VERIFIED
- **What was done:**
  - Removed `emergentintegrations.llm.chat` imports and `EMERGENT_LLM_KEY`
  - Added `google.generativeai as genai`, `groq.AsyncGroq`, `asyncio`, `json`
  - Added env vars: `GEMINI_API_KEY`, `GROQ_API_KEY`
  - Updated `ATSAnalysis` model with dual fields: `gemini_score`, `gemini_feedback`, `gemini_strengths`, `gemini_improvements`, `groq_score`, `groq_feedback`, `groq_strengths`, `groq_improvements`
  - `score` = combined average of both AI scores
  - Created `call_gemini()` (gemini-1.5-flash) and `call_groq()` (llama-3.3-70b-versatile) async functions
  - Both run in parallel via `asyncio.gather()` with graceful fallback
  - Helper functions: `build_ats_prompt()`, `parse_ai_response()`, `ATS_SYSTEM_PROMPT`

### 1.3 Replace Stripe Wrapper in `backend/server.py`
- **Status:** DONE ✅ VERIFIED
- **What was done:**
  - Removed `emergentintegrations.payments.stripe.checkout` imports
  - Added `import stripe`, set `stripe.api_key` from env
  - Added `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL` env vars
  - Created new models: `CheckoutResponse(session_id, url)`, `PaymentStatusResponse(session_id, status, payment_status)`
  - `POST /payments/checkout` → `stripe.checkout.Session.create()` with `FRONTEND_URL` for success/cancel
  - `GET /payments/status/{session_id}` → `stripe.checkout.Session.retrieve()`
  - `POST /webhook/stripe` → `stripe.Webhook.construct_event()` with signature verification

### 1.4 Add health check endpoint
- **Status:** DONE ✅ VERIFIED
- **What was done:** Added `GET /health` returning `{"status": "ok"}` on the app (not api_router, so it's at `/health` not `/api/health`)

### 1.5 Python syntax check
- **Status:** DONE ✅ — `python3 -m py_compile server.py` passed with no errors

---

## Phase 2: Frontend — Clean Emergent Code & Dual Score UI

### 2.1 Clean `frontend/public/index.html`
- **Status:** DONE ✅ VERIFIED
- **What was done:**
  - Removed: Emergent meta description, old title, DOMException error handler script, emergent-main.js script, iframe visual edit scripts, Emergent badge `<a>` element, PostHog analytics script
  - Changed title to "CareerArchitect - ATS Resume Builder"
  - Added meta description
  - Added Google AdSense script tag (placeholder `ca-pub-XXXXXXXX`)

### 2.2 Update `frontend/src/pages/ATSAnalysis.js` for Dual AI Scores
- **Status:** DONE ✅ VERIFIED
- **What was done:**
  - Created `ScoreCard` component (purple theme for Gemini, blue for Groq)
  - Created `FeedbackSection` component (reusable for each AI's feedback/strengths/improvements)
  - Side-by-side dual score cards + combined average score below
  - Separate Gemini and Groq feedback sections
  - Fallback to single feedback display for older analyses without dual data
  - Loading text: "Analyzing with Gemini & Groq AI..."
  - Replaced ad placeholder with `<AdSense>` component (hidden for premium users)

### 2.3 Create `frontend/src/components/AdSense.js`
- **Status:** DONE ✅ VERIFIED

### 2.4 Replace Ad Placeholders with AdSense Component
- **Status:** DONE ✅ VERIFIED
- **Files:** ATSAnalysis.js, Pricing.js, Dashboard.js — all hidden for premium users

### 2.5 Create `frontend/src/components/AffiliateLinks.js`
- **Status:** DONE ✅ VERIFIED

### 2.6 Add Affiliate Links to Pages
- **Status:** DONE ✅ VERIFIED
- **Files:** LandingPage.js (footer), Pricing.js (below ad), Dashboard.js (below analyses)

---

## Phase 3: Deployment Configuration

### 3.1 `frontend/vercel.json`
- **Status:** DONE ✅
- **Content:** SPA rewrite rule + `installCommand: yarn install` + `buildCommand: yarn build`

### 3.2 `backend/Procfile`
- **Status:** DONE ✅
- **Content:** `web: uvicorn server:app --host 0.0.0.0 --port $PORT`

### 3.3 `backend/render.yaml`
- **Status:** DONE ✅
- **Content:** Full Render IaC config, Python 3.11.6 pinned, health check at `/health`

### 3.4 `backend/.python-version`
- **Status:** DONE ✅
- **Content:** `3.11.6` — ensures Render uses Python 3.11 not 3.14

### 3.5 `frontend/.npmrc`
- **Status:** DONE ✅
- **Content:** `legacy-peer-deps=true`

### 3.6 `frontend/.nvmrc`
- **Status:** DONE ✅
- **Content:** `20` — pins Node 20.x on Vercel

---

## Phase 4: Deployment Progress

### Frontend (Vercel) — DEPLOYED ✅
- **URL:** `https://resume-builder-app-mu-seven.vercel.app`
- **Status:** Live and serving the React app
- **Build fixes applied (in order):**
  1. `date-fns` downgraded from v4 → v3 (react-day-picker peer dep conflict)
  2. `.npmrc` added with `legacy-peer-deps=true`
  3. `.nvmrc` + `engines` field to pin Node 20.x (Node 24 incompatible with CRA)
  4. `--openssl-legacy-provider` added to build script (Node 20 + webpack 4)
  5. Yarn `resolutions` for `react-scripts/ajv@6.12.6` and `react-scripts/ajv-keywords@3.5.2` (MODULE_NOT_FOUND fix)
  6. `CI=false` in build command (ESLint warnings treated as errors)
- **Env var needed:** `REACT_APP_BACKEND_URL` = `https://resumebuilder-api.onrender.com` (set after backend deploys, then redeploy)

### Backend (Render) — IN PROGRESS 🔄
- **Service name:** `resumebuilder-api`
- **Expected URL:** `https://resumebuilder-api.onrender.com`
- **Status:** Service created, build in progress. Last build failed due to Python 3.14 grpcio conflict — fixed by simplifying requirements.txt to flexible ranges + pinning Python 3.11.6.
- **IMPORTANT:** If service was created manually (not via Blueprint), ensure `PYTHON_VERSION=3.11.6` env var is set in Render dashboard.
- **Env vars to set on Render:**

| Variable | Value | Status |
|----------|-------|--------|
| `MONGO_URL` | MongoDB Atlas connection string | User needs to provide |
| `DB_NAME` | `resume_builder` | Set |
| `JWT_SECRET` | Secure random 32+ char string | Auto-generated if Blueprint, else set manually |
| `GEMINI_API_KEY` | From Google AI Studio | User needs to provide |
| `GROQ_API_KEY` | From Groq Cloud | User needs to provide |
| `STRIPE_API_KEY` | From Stripe dashboard (test mode `sk_test_...`) | User needs to provide |
| `STRIPE_WEBHOOK_SECRET` | Can be empty for now | Skip for now |
| `CORS_ORIGINS` | `https://resume-builder-app-mu-seven.vercel.app` | Set |
| `FRONTEND_URL` | `https://resume-builder-app-mu-seven.vercel.app` | Set |
| `PYTHON_VERSION` | `3.11.6` | CRITICAL — must be set |

---

## Phase 5: Verification

### Automated checks completed
- [x] Backend syntax check: `python3 -m py_compile server.py` — PASSED
- [x] Backend agent verification: 26/26 checks passed (imports, models, endpoints, no emergent refs)
- [x] Frontend HTML agent verification: All checks passed (clean HTML, AdSense, no emergent)
- [x] Frontend components agent verification: All checks passed (AdSense.js, AffiliateLinks.js)
- [x] Frontend pages agent verification: 23/23 checks passed (dual scores, ads, affiliates)
- [x] Frontend Vercel deployment: Build succeeds, app is live

### Manual checks remaining
- [ ] Backend Render deployment: Waiting for successful build with Python 3.11.6
- [ ] Backend health check: Visit `https://resumebuilder-api.onrender.com/health` → expect `{"status":"ok"}`
- [ ] Set `REACT_APP_BACKEND_URL` on Vercel → redeploy frontend
- [ ] End-to-end: Register → Resume → ATS analysis → Dual scores → Payment → Ads
- [ ] Stripe webhook setup: Create webhook in Stripe pointing to `https://resumebuilder-api.onrender.com/api/webhook/stripe`
- [ ] Replace AdSense `ca-pub-XXXXXXXX` placeholder with real publisher ID after AdSense approval
- [ ] Replace affiliate placeholder URLs with actual tracking URLs

---

## Files Modified (complete list)

| File | Status | Action |
|------|--------|--------|
| `backend/requirements.txt` | DONE ✅ | Simplified to 13 top-level deps with flexible ranges |
| `backend/server.py` | DONE ✅ | Full rewrite: dual AI + direct Stripe + health check |
| `backend/Procfile` | DONE ✅ | Created for Render |
| `backend/render.yaml` | DONE ✅ | Render IaC with Python 3.11.6 pinned |
| `backend/.python-version` | DONE ✅ | Pins Python 3.11.6 on Render |
| `frontend/public/index.html` | DONE ✅ | Cleaned Emergent, added AdSense script |
| `frontend/vercel.json` | DONE ✅ | SPA routing + install/build commands |
| `frontend/.npmrc` | DONE ✅ | `legacy-peer-deps=true` |
| `frontend/.nvmrc` | DONE ✅ | Pins Node 20.x |
| `frontend/package.json` | DONE ✅ | date-fns v3, Node 20 engine, CI=false build, ajv resolutions |
| `frontend/src/components/AdSense.js` | DONE ✅ | Created — reusable ad component |
| `frontend/src/components/AffiliateLinks.js` | DONE ✅ | Created — career resource links |
| `frontend/src/pages/ATSAnalysis.js` | DONE ✅ | Dual score UI, AdSense |
| `frontend/src/pages/Pricing.js` | DONE ✅ | AdSense + AffiliateLinks |
| `frontend/src/pages/Dashboard.js` | DONE ✅ | AdSense + AffiliateLinks |
| `frontend/src/pages/LandingPage.js` | DONE ✅ | AffiliateLinks in footer |

---

## Git Commit History (this session)

1. `873ffb7` — Main migration commit (all code changes)
2. `855ed9f` — Fix: downgrade date-fns v4→v3 for react-day-picker
3. `dd8fbd3` — Fix: pin Node 18.x (later changed to 20.x)
4. `ca3897b` — Fix: pin Node to 20.x (lowest available on Vercel)
5. `9b07459` — Fix: ajv resolutions (first attempt — wrong versions)
6. `a3070e7` — Fix: correct ajv resolutions to v6 + scoped schema-utils
7. `45d6b11` — Fix: scope ajv resolutions to react-scripts only, remove schema-utils
8. `266daaf` — Fix: CI=false to treat ESLint warnings as warnings
9. `b29c2b2` — Fix: simplify backend requirements + pin Python 3.11.6

---

## Remaining Work (pick up here if session ended)

### IMMEDIATE NEXT STEPS:
1. **Wait for Render backend build** — should succeed now with Python 3.11.6 + simplified deps
2. **Verify backend health:** `https://resumebuilder-api.onrender.com/health` → `{"status":"ok"}`
3. **Set Vercel env var:** `REACT_APP_BACKEND_URL` = `https://resumebuilder-api.onrender.com` → redeploy frontend
4. **Test end-to-end flow** in browser

### LATER:
5. **Stripe webhook** — Create endpoint in Stripe dashboard pointing to backend
6. **AdSense** — Apply for Google AdSense, replace `ca-pub-XXXXXXXX` when approved
7. **Affiliate links** — Sign up for affiliate programs, replace placeholder URLs
8. **Render cold starts** — Consider cron ping service to keep free tier warm (first request after 15min inactivity takes ~30s)
