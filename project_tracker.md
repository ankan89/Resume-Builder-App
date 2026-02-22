# Project Tracker: CareerArchitect — Resume Builder App

> **Last updated:** 2026-02-23 (Session 3 — AI Batch Resume Generation — DEPLOYED)
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

## Phase 6: AI Batch Resume Generation (Session 3)

> **Date:** 2026-02-23
> **Approach:** Planned in plan mode, then implemented via **4 parallel subagents** using cost-optimized model selection.

### 6.1 Implementation Strategy — Subagent Architecture

| # | Subagent Task | Model Used | Token Usage | Duration |
|---|--------------|------------|-------------|----------|
| 1 | Backend: models, presets, AI callers, 2 endpoints (`server.py`) | **Claude Sonnet** | ~35,600 tokens | ~91s |
| 2 | Frontend: Create `BatchGenerate.js` (3-step wizard, ~500 LOC) | **Claude Sonnet** | ~24,100 tokens | ~120s |
| 3 | Frontend: Add route in `App.js` | **Claude Haiku** | ~14,400 tokens | ~8s |
| 4 | Frontend: Add button in `Dashboard.js` | **Claude Haiku** | ~17,900 tokens | ~11s |

**Why this split:** Sonnet for complex multi-edit/generation tasks (backend logic, large new component). Haiku for simple 2-line edits (import + route, import + button). All 4 agents ran **in parallel** since they touched independent files.

### 6.2 Backend Changes — Status: DONE ✅

**New Models:**
- `ExperienceEntry`, `EducationEntry` — structured input for batch requests
- `BatchGenerateRequest` — personal_info, summary, experience, education, skills, job_profiles (max 5), template
- `BatchGenerateResponse` — list of resumes + generation_stats

**Resume Model Updated:**
- Added `job_profile: Optional[str] = None` and `batch_generated: bool = False`

**Job Profile Presets (8 profiles):**
`software_engineer`, `data_scientist`, `product_manager`, `ux_designer`, `marketing_manager`, `project_manager`, `devops_engineer`, `data_analyst`
— Each with: id, title, keywords (10), summary_focus, skills_categories (5)

**AI Generation Pipeline:**
- `RESUME_GENERATION_SYSTEM_PROMPT` — instructs AI to return JSON (summary, skills, experience, education)
- `build_resume_generation_prompt()` — merges user info + profile keywords into prompt
- `call_groq_generate()` — Groq (llama-3.3-70b), temp=0.4, max_tokens=3000
- `call_gemini_generate()` — Gemini 1.5 Flash fallback via `asyncio.to_thread()`

**New Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/resumes/job-profiles` | GET | Returns 8 preset profiles (auth required) |
| `/api/resumes/batch-generate` | POST | Generates up to 5 resumes in parallel, Groq→Gemini fallback |

**Validation & Limits:**
- Max 5 profiles per batch
- Invalid profile IDs rejected
- Free tier: max 5 total resumes (premium: unlimited)
- Graceful degradation: if both AI providers fail, returns empty with stats

**MongoDB Connection Fix:**
- Made TLS conditional: only enables `tls=True` + `tlsAllowInvalidCertificates=True` for Atlas URLs (`mongodb+srv` / `mongodb.net`), allowing local development without TLS.

### 6.3 Frontend Changes — Status: DONE ✅

**New File: `frontend/src/pages/BatchGenerate.js`** (~500 LOC)
- 3-step wizard with visual progress indicator (circles + connecting lines)
- **Step 1 — Base Information:** Personal info (2-col grid), summary textarea, dynamic experience entries (add/remove), dynamic education entries, skills textarea
- **Step 2 — Job Profile Selection:** Fetches profiles from API, selectable cards with keyword tags, max 5 selection with counter, template dropdown (modern/classic/creative/minimal)
- **Step 3 — Generation & Results:** Loading spinners per profile → success/fail indicators, Edit/Analyze buttons per resume, generation stats, "Back to Dashboard" link
- Breadcrumb navigation (Dashboard / Batch Generate)

**Modified: `frontend/src/App.js`**
- Added `import BatchGenerate` + auth-protected route for `/batch-generate`

**Modified: `frontend/src/pages/Dashboard.js`**
- Added `Zap` icon import
- Added "AI Multi-Resume" button (purple-to-blue gradient) next to "New Resume" button

### 6.4 Testing Results — Status: DONE ✅

**Backend Endpoint Tests (curl):**
| Test | Expected | Result |
|------|----------|--------|
| `GET /api/resumes/job-profiles` | 200, 8 profiles | ✅ Returns all 8 with keywords |
| `POST batch-generate` — invalid profile | 400 | ✅ `"Invalid job profile: fake_profile"` |
| `POST batch-generate` — >5 profiles | 400 | ✅ `"Maximum 5 job profiles allowed"` |
| `POST batch-generate` — empty profiles | 400 | ✅ `"At least one job profile is required"` |
| `POST batch-generate` — valid (no AI keys) | 200, graceful fail | ✅ `0/5 successful, 5 failed` |
| Free tier limit enforcement | Allows if under 5 | ✅ Passes |

**Frontend Tests:**
| Test | Result |
|------|--------|
| Webpack compilation | ✅ Compiled (only pre-existing eslint warnings) |
| `/batch-generate` route serves | ✅ HTTP 200 |
| `BatchGenerate` in JS bundle | ✅ 314 references |
| `AI Multi-Resume` button in bundle | ✅ Present |
| 3-step wizard UI flow | ✅ Verified in browser |
| Generation results display | ✅ Shows success/fail per profile |

---

## Files Modified (Session 3)

| File | Action | Agent |
|------|--------|-------|
| `backend/server.py` | Modified — models, presets, AI callers, 2 endpoints, TLS fix | Sonnet |
| `frontend/src/pages/BatchGenerate.js` | **Created** — 3-step batch generation wizard | Sonnet |
| `frontend/src/App.js` | Modified — import + route | Haiku |
| `frontend/src/pages/Dashboard.js` | Modified — Zap import + AI Multi-Resume button | Haiku |
| `backend/.env` | Created — local dev placeholder (gitignored) | Manual |
| `frontend/.env` | Created — local dev REACT_APP_BACKEND_URL | Manual |

---

### 6.5 Deployment — Status: DONE ✅

- **Git commit:** `ae713ea` — "Add AI batch resume generation: 5 profiles, parallel AI, 3-step wizard"
- **Pushed to:** `origin/main` on GitHub (`ankan89/Resume-Builder-App`)
- **Both platforms have GitHub auto-deploy enabled** — push triggers rebuild automatically

**Vercel (Frontend):**
- Auto-deployed from push — status: **Ready** ✅
- Production URL: `https://resume-builder-app-mu-seven.vercel.app`
- Build: compiled successfully (only pre-existing eslint dep warnings)
- Note: Vercel CLI was installed and logged in (`vercel login`). Do NOT use `vercel --prod` from `frontend/` — it creates a duplicate project. The existing project is connected via Vercel dashboard GitHub integration.

**Render (Backend):**
- Auto-deployed from push — status: **Live** ✅
- Production URL: `https://rdsumebuilder-api.onrender.com`
- Verified: `GET /api/resumes/job-profiles` returns all 8 profiles on production
- AI keys (`GEMINI_API_KEY`, `GROQ_API_KEY`) already configured on Render — batch generation should work with real AI

### 6.6 Local Development Setup (created this session)

**`backend/.env`** (gitignored):
```
MONGO_URL=mongodb://localhost:27017/?tls=false
DB_NAME=resume_builder
JWT_SECRET=test-secret-key-local
GEMINI_API_KEY=        # empty — AI calls fail gracefully
GROQ_API_KEY=          # empty — AI calls fail gracefully
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

**`frontend/.env`** (gitignored):
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Local dependencies installed:**
- MongoDB Community (via `brew install mongodb-community`) — start with: `mongod --dbpath /tmp/mongodb_test --port 27017 &`
- Backend: `pip3 install -r requirements.txt` → run with `python3 -m uvicorn server:app --host 0.0.0.0 --port 8001`
- Frontend: `npm install` (+ `npm install ajv@8` to fix craco dep) → run with `npm start` on port 3000
- Vercel CLI: installed globally (`npm i -g vercel`), logged in

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
16. `0ee1240` — Update project tracker: deployment complete, registration working
17. `ae713ea` — **Add AI batch resume generation** (Session 3)

---

## Session History & AI Models Used

| Session | Date | Work Done | Primary Model | Subagents |
|---------|------|-----------|---------------|-----------|
| 1 | 2026-02-22 | Emergent → Vercel/Render migration, dual AI, deployment fixes | Claude | — |
| 2 | 2026-02-22 | Deployment complete, registration verified | Claude | — |
| 3 | 2026-02-23 | AI Batch Resume Generation feature (plan → implement → test → deploy) | **Claude Opus 4.6** | 4 parallel (see §6.1) |

**Session 3 subagent details:**
- **Orchestrator:** Claude Opus 4.6 — planning, coordination, testing, deployment
- **Agent 1 (Sonnet):** Backend `server.py` — all models, presets, AI callers, endpoints (~35.6k tokens, 91s)
- **Agent 2 (Sonnet):** Frontend `BatchGenerate.js` — full 3-step wizard component (~24.1k tokens, 120s)
- **Agent 3 (Haiku):** Frontend `App.js` — 2-line edit: import + route (~14.4k tokens, 8s)
- **Agent 4 (Haiku):** Frontend `Dashboard.js` — 2-line edit: import + button (~17.9k tokens, 11s)

**Cost optimization strategy:** Sonnet for complex multi-edit tasks, Haiku for trivial edits. All 4 ran in parallel (independent files).

---

## Current App Architecture

```
Frontend (Vercel)                    Backend (Render)                  Database
┌─────────────────────┐    API     ┌─────────────────────┐          ┌──────────┐
│ React + Tailwind    │ ────────→ │ FastAPI + Uvicorn    │ ───────→ │ MongoDB  │
│ react-router-dom    │           │ Pydantic models      │          │ Atlas    │
│ axios, lucide-react │           │ Dual AI (Groq+Gemini)│          └──────────┘
│ recharts            │           │ Stripe payments      │
└─────────────────────┘           │ JWT auth + bcrypt    │
                                  └─────────────────────┘
Pages:
  / ................ LandingPage.js
  /dashboard ....... Dashboard.js        (resume list, stats, ATS history)
  /builder/:id ..... ResumeBuilder.js    (create/edit resume)
  /ats/:resumeId ... ATSAnalysis.js      (dual Gemini+Groq ATS scoring)
  /batch-generate .. BatchGenerate.js    (NEW — 3-step AI multi-resume wizard)
  /pricing ......... Pricing.js          (Stripe checkout)
  /success ......... Success.js          (payment confirmation)

API Endpoints:
  POST /api/auth/register          POST /api/auth/login           GET  /api/auth/me
  GET  /api/resumes                POST /api/resumes              GET  /api/resumes/{id}
  PUT  /api/resumes/{id}           DELETE /api/resumes/{id}
  GET  /api/resumes/job-profiles   POST /api/resumes/batch-generate    (NEW)
  POST /api/ats/analyze            GET  /api/ats/analyses
  POST /api/payments/checkout      GET  /api/payments/status/{id}
  POST /api/webhook/stripe
```

---

## Remaining Work (pick up here if session ended)

### IMMEDIATE:
1. **Test batch generation with real AI on production** — Login on live site, try batch-generate with real Groq/Gemini keys
2. **Test full existing flow** — Login → Create Resume → ATS Analysis → see dual Gemini/Groq scores
3. **Test payment** — Click Upgrade → Stripe checkout (test mode)

### ENHANCEMENTS:
4. Loading skeleton states in BatchGenerate Step 2 (while profiles fetch)
5. Show batch-generated resumes with a badge/tag on Dashboard
6. Allow re-generation of failed profiles without re-entering all info

### INFRASTRUCTURE:
7. Stripe webhook: Create endpoint in Stripe dashboard → `https://rdsumebuilder-api.onrender.com/api/webhook/stripe` → set `STRIPE_WEBHOOK_SECRET` on Render
8. AdSense: Apply at Google AdSense → replace `ca-pub-XXXXXXXX` in `index.html` and `AdSense.js`
9. Affiliate links: Sign up for programs → replace placeholder URLs with tracking links
10. Render cold starts: Consider cron ping to keep free tier warm (15min inactivity = ~30s cold start)
11. Migrate deprecated `google.generativeai` → `google.genai` (warning on every startup, still works)
