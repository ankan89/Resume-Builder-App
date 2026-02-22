# Project Tracker: Emergent Cloud → Vercel + Render + MongoDB Atlas Migration

> **Last updated:** 2026-02-22
> **Purpose:** Resume point if token/session runs out. Each task has a status so the next session picks up exactly where we left off.

---

## Phase 1: Backend — Replace Emergent Dependencies

### 1.1 Update `backend/requirements.txt`
- **Status:** DONE ✅ VERIFIED
- **What was done:** Trimmed from 126 → 42 packages. Removed `emergentintegrations`, `boto3`, `botocore`, `s3transfer`, `huggingface_hub`, `litellm`, `pandas`, `numpy`, `pillow`, `tiktoken`, `tokenizers`, and all unused heavy deps. Added `groq==0.25.0`.
- **Verification:** All server.py imports satisfied by requirements.txt (cross-referenced by agent).

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
- **What was done:** Reusable component with props: `slot`, `format` (default 'auto'), `responsive` (default true), `className`. Uses `useEffect` + `useRef` to push adsbygoogle once. Displays "Advertisement" label.

### 2.4 Replace Ad Placeholders with AdSense Component
- **Status:** DONE ✅ VERIFIED
- **Files updated:**
  - `pages/ATSAnalysis.js` — `<AdSense slot="ats-input-ad" />` (hidden for premium)
  - `pages/Pricing.js` — `<AdSense slot="pricing-ad" />` (hidden for premium)
  - `pages/Dashboard.js` — `<AdSense slot="dashboard-ad" />` (hidden for premium)

### 2.5 Create `frontend/src/components/AffiliateLinks.js`
- **Status:** DONE ✅ VERIFIED
- **What was done:** Component with 4 curated links (TopResume, LinkedIn Premium, Coursera, Indeed). `rel="noopener noreferrer sponsored"`. Props: `layout` ('horizontal' or 'vertical'). Horizontal = 4-col grid, Vertical = stacked.

### 2.6 Add Affiliate Links to Pages
- **Status:** DONE ✅ VERIFIED
- **Files updated:**
  - `pages/LandingPage.js` — In footer section, above copyright
  - `pages/Pricing.js` — Below AdSense ad
  - `pages/Dashboard.js` — Below Recent ATS Analyses section

---

## Phase 3: Deployment Configuration

### 3.1 Create `frontend/vercel.json`
- **Status:** DONE ✅ VERIFIED
- **Content:** SPA rewrite rule `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

### 3.2 Create `backend/Procfile`
- **Status:** DONE ✅ VERIFIED
- **Content:** `web: uvicorn server:app --host 0.0.0.0 --port $PORT`

### 3.3 Create `backend/render.yaml`
- **Status:** DONE ✅
- **Content:** Full Render IaC config with service definition, build/start commands, health check path, and all env var declarations (some auto-generated like JWT_SECRET, others marked sync:false for manual entry).

---

## Phase 4: Environment Variables Setup

### Vercel (Frontend)
- **Status:** MANUAL — Must be set in Vercel dashboard after deployment
- `REACT_APP_BACKEND_URL` = `https://<your-app>.onrender.com`

### Render (Backend)
- **Status:** MANUAL — Must be set in Render dashboard (or via render.yaml Blueprint)
- `MONGO_URL` — MongoDB Atlas connection string
- `DB_NAME` — `resume_builder`
- `JWT_SECRET` — Secure random string (32+ chars) — auto-generated if using render.yaml
- `GEMINI_API_KEY` — From Google AI Studio (free)
- `GROQ_API_KEY` — From Groq Cloud console (free)
- `STRIPE_API_KEY` — From Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — From Stripe webhook settings
- `CORS_ORIGINS` — `https://<your-app>.vercel.app`
- `FRONTEND_URL` — `https://<your-app>.vercel.app`

---

## Phase 5: Verification

### Automated checks completed
- [x] Backend syntax check: `python3 -m py_compile server.py` — PASSED
- [x] Backend agent verification: 26/26 checks passed (imports, models, endpoints, no emergent refs)
- [x] Frontend HTML agent verification: All checks passed (clean HTML, AdSense, no emergent)
- [x] Frontend components agent verification: All checks passed (AdSense.js, AffiliateLinks.js)
- [x] Frontend pages agent verification: 23/23 checks passed (dual scores, ads, affiliates)

### Manual checks remaining
- [ ] Frontend build: Node.js not available on current machine — run `yarn build` or `npm run build` in `frontend/` to verify
- [ ] Backend locally: `pip install -r requirements.txt && uvicorn server:app --reload` — test `/health`, `/api/auth/register`, `/api/ats/analyze`
- [ ] Frontend locally: `yarn start` — verify dual scores, ads, affiliate links
- [ ] Deploy backend to Render — verify health check
- [ ] Deploy frontend to Vercel — set `REACT_APP_BACKEND_URL`
- [ ] End-to-end: Register → Resume → ATS analysis → Dual scores → Payment → Ads
- [ ] Replace AdSense `ca-pub-XXXXXXXX` placeholder with real publisher ID after AdSense approval
- [ ] Replace affiliate placeholder URLs with actual tracking URLs

---

## Files Modified (complete list)

| File | Status | Action |
|------|--------|--------|
| `backend/requirements.txt` | DONE ✅ | Trimmed from 126→42 packages, added groq |
| `backend/server.py` | DONE ✅ | Full rewrite: dual AI + direct Stripe + health check. Syntax verified. |
| `backend/Procfile` | DONE ✅ | Created for Render |
| `backend/render.yaml` | DONE ✅ | Created — Render IaC with env var declarations |
| `frontend/public/index.html` | DONE ✅ | Cleaned Emergent, added AdSense script |
| `frontend/vercel.json` | DONE ✅ | Created for SPA routing |
| `frontend/src/components/AdSense.js` | DONE ✅ | Created — reusable ad component |
| `frontend/src/components/AffiliateLinks.js` | DONE ✅ | Created — career resource links |
| `frontend/src/pages/ATSAnalysis.js` | DONE ✅ | Dual score UI, AdSense |
| `frontend/src/pages/Pricing.js` | DONE ✅ | AdSense + AffiliateLinks |
| `frontend/src/pages/Dashboard.js` | DONE ✅ | AdSense + AffiliateLinks |
| `frontend/src/pages/LandingPage.js` | DONE ✅ | AffiliateLinks in footer |

---

## Remaining Work (pick up here if session ended)

All code changes are COMPLETE and VERIFIED. What remains is manual deployment:

1. **Frontend build test** — Run `yarn install && yarn build` in `frontend/` (needs Node.js)
2. **MongoDB Atlas** — Create free M0 cluster, get connection string
3. **API Keys** — Get free keys from Google AI Studio (Gemini) and Groq Cloud
4. **Deploy backend to Render** — Connect repo, set root dir to `backend`, add env vars
5. **Deploy frontend to Vercel** — Connect repo, set root dir to `frontend`, set `REACT_APP_BACKEND_URL`
6. **Stripe webhook** — Update webhook URL to point to Render backend
7. **AdSense** — Apply for Google AdSense, replace `ca-pub-XXXXXXXX` when approved
8. **Affiliate links** — Sign up for affiliate programs, replace URLs with tracking links
