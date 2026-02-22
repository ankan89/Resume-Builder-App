# Project Tracker: Emergent Cloud → Vercel + Render + MongoDB Atlas Migration

> **Last updated:** 2026-02-22 (Session 2 — Deployment Complete)
> **Purpose:** Resume point if token/session runs out. Each task has a status so the next session picks up exactly where we left off.

---

## Phase 1: Backend — Replace Emergent Dependencies

### 1.1 `backend/requirements.txt`
- **Status:** DONE ✅
- **Final deps (13 top-level):** `fastapi`, `uvicorn`, `motor>=3.6`, `pymongo>=4.10`, `pydantic[email]`, `PyJWT`, `bcrypt>=4.0`, `python-dotenv`, `python-multipart`, `google-generativeai`, `groq`, `stripe`, `httpx`, `certifi`

### 1.2 Replace LLM → Dual AI (Gemini + Groq)
- **Status:** DONE ✅
- Removed `emergentintegrations.llm.chat`. Added `google.generativeai`, `groq.AsyncGroq`.
- Dual `call_gemini()` + `call_groq()` running in parallel via `asyncio.gather()`.
- `ATSAnalysis` model has dual fields: `gemini_score/feedback/strengths/improvements` + `groq_score/feedback/strengths/improvements`. `score` = combined average.

### 1.3 Replace Stripe Wrapper → Direct SDK
- **Status:** DONE ✅
- Removed `emergentintegrations.payments.stripe.checkout`. Uses `stripe.checkout.Session.create/retrieve` + `stripe.Webhook.construct_event`.

### 1.4 Health check
- **Status:** DONE ✅ — `GET /health` returns `{"status": "ok"}`

### 1.5 Password hashing
- **Status:** DONE ✅
- Removed `passlib` (unmaintained, incompatible with bcrypt>=4.1). Uses `bcrypt` directly.

---

## Phase 2: Frontend — Clean Emergent Code & Dual Score UI

### 2.1–2.6 All frontend tasks
- **Status:** ALL DONE ✅
- Cleaned `index.html` (removed Emergent/PostHog/badge)
- Dual score UI in `ATSAnalysis.js` (Gemini purple + Groq blue cards)
- Created `AdSense.js` + `AffiliateLinks.js` components
- Updated `Dashboard.js`, `Pricing.js`, `LandingPage.js` with monetization

---

## Phase 3: Deployment Configuration

| File | Status |
|------|--------|
| `frontend/vercel.json` | DONE ✅ |
| `frontend/.nvmrc` | DONE ✅ (Node 20) |
| `frontend/.npmrc` | DONE ✅ (legacy-peer-deps) |
| `backend/Procfile` | DONE ✅ |
| `backend/render.yaml` | DONE ✅ |
| `backend/.python-version` | DONE ✅ (3.11.6) |

---

## Phase 4: Deployment

### Frontend (Vercel) — LIVE ✅
- **URL:** `https://resume-builder-app-mu-seven.vercel.app`
- **Env var:** `REACT_APP_BACKEND_URL` = `https://rdsumebuilder-api.onrender.com`
- **Build fixes applied:** date-fns v3, Node 20, ajv resolutions scoped to react-scripts, CI=false, openssl-legacy-provider

### Backend (Render) — LIVE ✅
- **URL:** `https://rdsumebuilder-api.onrender.com`
- **Health check:** `https://rdsumebuilder-api.onrender.com/health` → `{"status":"ok"}`
- **Registration:** Working ✅
- **Python version:** 3.11.6
- **Env vars set:**
  - `MONGO_URL` ✅
  - `DB_NAME` = `resume_builder` ✅
  - `JWT_SECRET` ✅
  - `GEMINI_API_KEY` ✅
  - `GROQ_API_KEY` ✅
  - `STRIPE_API_KEY` ✅
  - `STRIPE_WEBHOOK_SECRET` (empty — set later)
  - `CORS_ORIGINS` = `https://resume-builder-app-mu-seven.vercel.app` ✅
  - `FRONTEND_URL` = `https://resume-builder-app-mu-seven.vercel.app` ✅
  - `PYTHON_VERSION` = `3.11.6` ✅

### Deployment fixes applied (in order):
1. Simplified requirements.txt to flexible ranges (grpcio conflict on Python 3.14)
2. Pinned Python 3.11.6 via `.python-version` + `PYTHON_VERSION` env var
3. Added `certifi` + `tlsAllowInvalidCertificates=True` for MongoDB Atlas SSL
4. Upgraded `pymongo>=4.10` + `motor>=3.6` (old versions had SSL issues)
5. Replaced `passlib` with direct `bcrypt` (passlib incompatible with bcrypt>=4.1)

---

## Phase 5: Verification

### Completed ✅
- [x] Backend health check: `{"status":"ok"}`
- [x] User registration: Working
- [x] Frontend deployed and serving React app
- [x] Frontend connected to backend via `REACT_APP_BACKEND_URL`
- [x] CORS working (OPTIONS preflight returns 200)

### Still to test
- [ ] User login
- [ ] Create resume
- [ ] ATS analysis (dual Gemini + Groq scores)
- [ ] Payment flow (Stripe checkout)
- [ ] Ad components rendering
- [ ] Affiliate links working

### Future setup
- [ ] Stripe webhook: Create endpoint in Stripe dashboard → `https://rdsumebuilder-api.onrender.com/api/webhook/stripe` → get `whsec_...` → set `STRIPE_WEBHOOK_SECRET` on Render
- [ ] AdSense: Apply at Google AdSense → replace `ca-pub-XXXXXXXX` in `index.html` and `AdSense.js`
- [ ] Affiliate links: Sign up for programs → replace placeholder URLs with tracking links
- [ ] Render cold starts: Consider cron ping to keep free tier warm (15min inactivity = ~30s cold start)
- [ ] Migrate `google.generativeai` → `google.genai` (deprecated warning, still works)

---

## Files Modified (complete list)

| File | Action |
|------|--------|
| `backend/requirements.txt` | Simplified to 14 top-level deps, flexible ranges |
| `backend/server.py` | Full rewrite: dual AI, direct Stripe, direct bcrypt, certifi TLS |
| `backend/Procfile` | Created for Render |
| `backend/render.yaml` | Created — Render IaC |
| `backend/.python-version` | Created — pins Python 3.11.6 |
| `frontend/public/index.html` | Cleaned Emergent, added AdSense |
| `frontend/vercel.json` | Created — SPA routing + build config |
| `frontend/.npmrc` | Created — legacy-peer-deps |
| `frontend/.nvmrc` | Created — Node 20 |
| `frontend/package.json` | date-fns v3, CI=false, ajv resolutions, Node 20 engine |
| `frontend/src/components/AdSense.js` | Created — reusable ad component |
| `frontend/src/components/AffiliateLinks.js` | Created — career resource links |
| `frontend/src/pages/ATSAnalysis.js` | Dual score UI + AdSense |
| `frontend/src/pages/Pricing.js` | AdSense + AffiliateLinks |
| `frontend/src/pages/Dashboard.js` | AdSense + AffiliateLinks |
| `frontend/src/pages/LandingPage.js` | AffiliateLinks in footer |

---

## Git Commit History

1. `873ffb7` — Main migration commit (all code changes)
2. `855ed9f` — Fix: date-fns v4→v3 for react-day-picker
3. `dd8fbd3` — Fix: pin Node 18 (later changed)
4. `ca3897b` — Fix: pin Node 20
5. `9b07459` — Fix: ajv resolutions (wrong versions)
6. `a3070e7` — Fix: correct ajv resolutions to v6
7. `45d6b11` — Fix: scope ajv resolutions to react-scripts only
8. `266daaf` — Fix: CI=false for ESLint warnings
9. `b29c2b2` — Fix: simplify backend requirements + pin Python 3.11.6
10. `de319fa` — Update project tracker
11. `d4ddf71` — Fix: MongoDB SSL with certifi
12. `33fd9dd` — Fix: upgrade pymongo/motor for TLS
13. `123a0b6` — Fix: tlsAllowInvalidCertificates workaround
14. `bbe19a1` — Fix: pin bcrypt==4.0.1 for passlib
15. `748c20d` — Fix: replace passlib with direct bcrypt

---

## Remaining Work (pick up here if session ended)

### IMMEDIATE:
1. **Test full flow** — Login → Create Resume → ATS Analysis → see dual Gemini/Groq scores
2. **Test payment** — Click Upgrade → Stripe checkout (test mode)

### LATER:
3. Stripe webhook setup
4. AdSense approval + real publisher ID
5. Affiliate tracking URLs
6. Render cold start ping service
7. Migrate deprecated `google.generativeai` → `google.genai`
