# Project Tracker: Emergent Cloud → Vercel + Render + MongoDB Atlas Migration

> **Last updated:** 2026-02-23 (Session 3 — AI Batch Resume Generation Feature)
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

## Git Commit History

1–15. *(Previous commits — see above)*

---

## Remaining Work (pick up here if session ended)

### IMMEDIATE:
1. **Deploy batch-generate to production** — Push changes, redeploy backend on Render + frontend on Vercel
2. **Add AI API keys to local .env** — Test actual AI resume generation end-to-end
3. **Test full flow** — Login → Create Resume → ATS Analysis → see dual Gemini/Groq scores
4. **Test payment** — Click Upgrade → Stripe checkout (test mode)

### LATER:
5. Stripe webhook setup
6. AdSense approval + real publisher ID
7. Affiliate tracking URLs
8. Render cold start ping service
9. Migrate deprecated `google.generativeai` → `google.genai`
10. Add loading skeleton states in BatchGenerate Step 2 (profile fetch)
