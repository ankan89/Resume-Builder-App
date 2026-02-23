from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from google import genai
from groq import AsyncGroq
import stripe
import certifi
import ssl

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
_use_tls = 'mongodb+srv' in mongo_url or 'mongodb.net' in mongo_url
_mongo_kwargs = dict(serverSelectionTimeoutMS=10000)
if _use_tls:
    _mongo_kwargs.update(tls=True, tlsAllowInvalidCertificates=True)
client = AsyncIOMotorClient(mongo_url, **_mongo_kwargs)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')

# AI API keys
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')

# Stripe
stripe.api_key = os.environ.get('STRIPE_API_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Configure Gemini
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ========== MODELS ==========

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    is_premium: bool = False
    ats_checks_used: int = 0
    ats_checks_limit: int = 10
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: User

class ResumeSection(BaseModel):
    type: str
    content: Any

class Resume(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    template: str = "modern"
    sections: List[ResumeSection] = []
    job_profile: Optional[str] = None
    batch_generated: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ResumeCreate(BaseModel):
    title: str
    template: str = "modern"
    sections: List[ResumeSection] = []

class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    template: Optional[str] = None
    sections: Optional[List[ResumeSection]] = None

class ExperienceEntry(BaseModel):
    position: str
    company: str
    duration: str
    description: str

class EducationEntry(BaseModel):
    degree: str
    institution: str
    year: str
    details: Optional[str] = ""

class BatchGenerateRequest(BaseModel):
    personal_info: Dict[str, str]       # name, email, phone, location
    summary_base: str
    experience: List[ExperienceEntry]
    education: List[EducationEntry]
    skills_base: str
    job_profiles: List[str]             # preset IDs, max 5
    template: str = "modern"

class BatchGenerateResponse(BaseModel):
    resumes: List[Dict[str, Any]]
    generation_stats: Dict[str, Any]

class ATSAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    resume_id: str
    job_description: str
    score: int
    feedback: str
    strengths: List[str] = []
    improvements: List[str] = []
    gemini_score: Optional[int] = None
    gemini_feedback: Optional[str] = None
    gemini_strengths: List[str] = []
    gemini_improvements: List[str] = []
    groq_score: Optional[int] = None
    groq_feedback: Optional[str] = None
    groq_strengths: List[str] = []
    groq_improvements: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ATSAnalysisRequest(BaseModel):
    resume_id: str
    job_description: str

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str
    status: str = "pending"
    payment_status: str = "initiated"
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CheckoutResponse(BaseModel):
    session_id: str
    url: str

class PaymentStatusResponse(BaseModel):
    session_id: str
    status: str
    payment_status: str

JOB_PROFILE_PRESETS = {
    "software_engineer": {
        "id": "software_engineer",
        "title": "Software Engineer",
        "keywords": ["algorithms", "data structures", "REST APIs", "microservices", "CI/CD", "agile", "code review", "system design", "unit testing", "version control"],
        "summary_focus": "software development expertise, problem-solving, and building scalable applications",
        "skills_categories": ["Programming Languages", "Frameworks", "Databases", "DevOps Tools", "Testing"]
    },
    "data_scientist": {
        "id": "data_scientist",
        "title": "Data Scientist",
        "keywords": ["machine learning", "statistical analysis", "Python", "R", "deep learning", "NLP", "data visualization", "A/B testing", "feature engineering", "big data"],
        "summary_focus": "data-driven decision making, statistical modeling, and extracting insights from complex datasets",
        "skills_categories": ["ML Frameworks", "Programming", "Statistics", "Data Tools", "Visualization"]
    },
    "product_manager": {
        "id": "product_manager",
        "title": "Product Manager",
        "keywords": ["product strategy", "roadmap", "user research", "agile", "stakeholder management", "KPIs", "market analysis", "prioritization", "cross-functional", "product lifecycle"],
        "summary_focus": "product vision, cross-functional leadership, and driving product-market fit",
        "skills_categories": ["Product Strategy", "Analytics", "Communication", "Technical", "Leadership"]
    },
    "ux_designer": {
        "id": "ux_designer",
        "title": "UX Designer",
        "keywords": ["user research", "wireframing", "prototyping", "usability testing", "design systems", "Figma", "user flows", "accessibility", "interaction design", "information architecture"],
        "summary_focus": "user-centered design, creating intuitive interfaces, and improving user experience",
        "skills_categories": ["Design Tools", "Research Methods", "UI Design", "Prototyping", "Accessibility"]
    },
    "marketing_manager": {
        "id": "marketing_manager",
        "title": "Marketing Manager",
        "keywords": ["digital marketing", "SEO", "content strategy", "brand management", "campaign management", "analytics", "social media", "lead generation", "marketing automation", "ROI optimization"],
        "summary_focus": "strategic marketing, brand growth, and data-driven campaign optimization",
        "skills_categories": ["Digital Marketing", "Analytics", "Content", "Advertising", "Strategy"]
    },
    "project_manager": {
        "id": "project_manager",
        "title": "Project Manager",
        "keywords": ["project planning", "risk management", "budget management", "stakeholder communication", "agile", "scrum", "resource allocation", "milestone tracking", "PMP", "cross-functional teams"],
        "summary_focus": "project delivery, team coordination, and managing complex initiatives on time and within budget",
        "skills_categories": ["Project Management", "Methodologies", "Tools", "Leadership", "Risk Management"]
    },
    "devops_engineer": {
        "id": "devops_engineer",
        "title": "DevOps Engineer",
        "keywords": ["CI/CD", "Docker", "Kubernetes", "AWS", "infrastructure as code", "monitoring", "automation", "Linux", "Terraform", "cloud architecture"],
        "summary_focus": "infrastructure automation, deployment pipelines, and ensuring system reliability at scale",
        "skills_categories": ["Cloud Platforms", "Containerization", "IaC Tools", "Monitoring", "Scripting"]
    },
    "data_analyst": {
        "id": "data_analyst",
        "title": "Data Analyst",
        "keywords": ["SQL", "data visualization", "Excel", "Tableau", "Power BI", "statistical analysis", "ETL", "reporting", "data cleaning", "business intelligence"],
        "summary_focus": "transforming data into actionable business insights through analysis and visualization",
        "skills_categories": ["Analytics Tools", "Databases", "Visualization", "Statistics", "Reporting"]
    }
}

RESUME_GENERATION_SYSTEM_PROMPT = """You are an expert resume writer and ATS optimization specialist. Given a user's base information and a target job profile, generate an optimized resume tailored for that role.

Return your response as JSON only with these keys:
- summary: A 2-3 sentence professional summary optimized for the target role
- skills: A comma-separated string of relevant skills (mix user's existing skills with role-specific ones)
- experience: An array of objects with keys: position, company, duration, description (enhance descriptions with role-relevant keywords and achievements)
- education: An array of objects with keys: degree, institution, year, details (keep as-is but add relevant coursework if applicable)"""

def build_resume_generation_prompt(personal_info, summary_base, experience, education, skills_base, profile):
    exp_text = "\n".join([f"- {e['position']} at {e['company']} ({e['duration']}): {e['description']}" for e in experience])
    edu_text = "\n".join([f"- {e['degree']} from {e['institution']} ({e['year']})" for e in education])

    return f"""Optimize this resume for a {profile['title']} position.

TARGET ROLE KEYWORDS: {', '.join(profile['keywords'])}
SUMMARY FOCUS: {profile['summary_focus']}
SKILLS CATEGORIES: {', '.join(profile['skills_categories'])}

USER'S BASE INFORMATION:
Name: {personal_info.get('name', '')}
Current Summary: {summary_base}
Skills: {skills_base}

Experience:
{exp_text}

Education:
{edu_text}

Generate an ATS-optimized resume. Enhance the content with relevant keywords naturally woven in. Keep factual information accurate but improve descriptions. Return JSON only."""


async def call_groq_generate(prompt: str) -> dict:
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": RESUME_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.4,
        max_tokens=3000
    )
    return parse_ai_response(response.choices[0].message.content)


async def call_gemini_generate(prompt: str) -> dict:
    if gemini_client is None:
        raise RuntimeError("Gemini client is not initialized: GEMINI_API_KEY is missing or not set")
    response = await asyncio.to_thread(
        gemini_client.models.generate_content,
        model='gemini-2.0-flash',
        contents=f"{RESUME_GENERATION_SYSTEM_PROMPT}\n\n{prompt}"
    )
    return parse_ai_response(response.text)

# ========== AUTH HELPERS ==========

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ========== HEALTH CHECK ==========

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# ========== AUTH ROUTES ==========

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        full_name=user_data.full_name
    )

    user_dict = user.model_dump()
    user_dict['password'] = hashed_pwd
    user_dict['created_at'] = user_dict['created_at'].isoformat()

    await db.users.insert_one(user_dict)
    token = create_token(user.id)

    return TokenResponse(token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    token = create_token(user.id)

    return TokenResponse(token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ========== RESUME ROUTES ==========

@api_router.post("/resumes", response_model=Resume)
async def create_resume(resume_data: ResumeCreate, current_user: User = Depends(get_current_user)):
    resume = Resume(
        user_id=current_user.id,
        title=resume_data.title,
        template=resume_data.template,
        sections=resume_data.sections
    )

    resume_dict = resume.model_dump()
    resume_dict['created_at'] = resume_dict['created_at'].isoformat()
    resume_dict['updated_at'] = resume_dict['updated_at'].isoformat()

    await db.resumes.insert_one(resume_dict)
    resume_dict.pop('_id', None)  # Remove MongoDB ObjectId (not JSON-serializable)
    return resume

@api_router.get("/resumes", response_model=List[Resume])
async def get_resumes(current_user: User = Depends(get_current_user)):
    resumes = await db.resumes.find({"user_id": current_user.id}, {"_id": 0}).to_list(100)
    for resume in resumes:
        if isinstance(resume.get('created_at'), str):
            resume['created_at'] = datetime.fromisoformat(resume['created_at'])
        if isinstance(resume.get('updated_at'), str):
            resume['updated_at'] = datetime.fromisoformat(resume['updated_at'])
    return resumes

# ========== BATCH GENERATION ROUTES ==========

@api_router.get("/resumes/job-profiles")
async def get_job_profiles(current_user: User = Depends(get_current_user)):
    profiles = [
        {"id": k, "title": v["title"], "keywords": v["keywords"], "summary_focus": v["summary_focus"], "skills_categories": v["skills_categories"]}
        for k, v in JOB_PROFILE_PRESETS.items()
    ]
    return profiles


@api_router.post("/resumes/batch-generate", response_model=BatchGenerateResponse)
async def batch_generate_resumes(request: BatchGenerateRequest, current_user: User = Depends(get_current_user)):
    # Validate max 5 profiles
    if len(request.job_profiles) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 job profiles allowed per batch")
    if len(request.job_profiles) == 0:
        raise HTTPException(status_code=400, detail="At least one job profile is required")

    # Validate profile IDs
    for profile_id in request.job_profiles:
        if profile_id not in JOB_PROFILE_PRESETS:
            raise HTTPException(status_code=400, detail=f"Invalid job profile: {profile_id}")

    # Check free tier limits
    if not current_user.is_premium:
        existing_count = await db.resumes.count_documents({"user_id": current_user.id})
        if existing_count + len(request.job_profiles) > 5:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit: you have {existing_count} resumes and can create {max(0, 5 - existing_count)} more. Upgrade to premium for unlimited resumes."
            )

    experience_dicts = [e.model_dump() for e in request.experience]
    education_dicts = [e.model_dump() for e in request.education]

    async def generate_single_resume(profile_id: str) -> dict:
        profile = JOB_PROFILE_PRESETS[profile_id]
        prompt = build_resume_generation_prompt(
            request.personal_info, request.summary_base,
            experience_dicts, education_dicts,
            request.skills_base, profile
        )

        ai_result = None
        ai_provider = None

        # Try Groq first (faster)
        try:
            ai_result = await call_groq_generate(prompt)
            ai_provider = "groq"
        except Exception as e:
            logging.error(f"Groq generation failed for {profile_id}: {str(e)}")

        # Fallback to Gemini
        if ai_result is None:
            try:
                ai_result = await call_gemini_generate(prompt)
                ai_provider = "gemini"
            except Exception as e:
                logging.error(f"Gemini generation failed for {profile_id}: {str(e)}")
                return None

        # Build resume sections from AI output
        sections = []

        # Personal info section
        sections.append(ResumeSection(type="personal", content=request.personal_info))

        # Summary
        sections.append(ResumeSection(type="summary", content=ai_result.get("summary", request.summary_base)))

        # Experience
        ai_experience = ai_result.get("experience", experience_dicts)
        for exp in ai_experience:
            sections.append(ResumeSection(type="experience", content=exp))

        # Education
        ai_education = ai_result.get("education", education_dicts)
        for edu in ai_education:
            sections.append(ResumeSection(type="education", content=edu))

        # Skills
        sections.append(ResumeSection(type="skills", content=ai_result.get("skills", request.skills_base)))

        resume = Resume(
            user_id=current_user.id,
            title=f"{request.personal_info.get('name', 'Resume')} - {profile['title']}",
            template=request.template,
            sections=sections,
            job_profile=profile_id,
            batch_generated=True
        )

        resume_dict = resume.model_dump()
        resume_dict['created_at'] = resume_dict['created_at'].isoformat()
        resume_dict['updated_at'] = resume_dict['updated_at'].isoformat()
        await db.resumes.insert_one(resume_dict)
        resume_dict.pop('_id', None)  # Remove MongoDB ObjectId (not JSON-serializable)

        return {"resume": resume_dict, "provider": ai_provider, "profile_id": profile_id}

    # Run all generations in parallel
    try:
        results = await asyncio.gather(*[generate_single_resume(pid) for pid in request.job_profiles])
    except Exception as e:
        logging.error(f"Batch generate unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {str(e)}")

    successful = [r for r in results if r is not None]
    failed = [request.job_profiles[i] for i, r in enumerate(results) if r is None]

    # Fix datetime fields for response
    resume_list = []
    for r in successful:
        res = r["resume"]
        if isinstance(res.get('created_at'), str):
            res['created_at'] = datetime.fromisoformat(res['created_at'])
        if isinstance(res.get('updated_at'), str):
            res['updated_at'] = datetime.fromisoformat(res['updated_at'])
        resume_list.append(res)

    return BatchGenerateResponse(
        resumes=resume_list,
        generation_stats={
            "total_requested": len(request.job_profiles),
            "successful": len(successful),
            "failed": len(failed),
            "failed_profiles": failed,
            "providers_used": {r["profile_id"]: r["provider"] for r in successful}
        }
    )


@api_router.get("/resumes/{resume_id}", response_model=Resume)
async def get_resume(resume_id: str, current_user: User = Depends(get_current_user)):
    resume = await db.resumes.find_one({"id": resume_id, "user_id": current_user.id}, {"_id": 0})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if isinstance(resume.get('created_at'), str):
        resume['created_at'] = datetime.fromisoformat(resume['created_at'])
    if isinstance(resume.get('updated_at'), str):
        resume['updated_at'] = datetime.fromisoformat(resume['updated_at'])

    return Resume(**resume)

@api_router.put("/resumes/{resume_id}", response_model=Resume)
async def update_resume(resume_id: str, update_data: ResumeUpdate, current_user: User = Depends(get_current_user)):
    resume = await db.resumes.find_one({"id": resume_id, "user_id": current_user.id}, {"_id": 0})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.resumes.update_one({"id": resume_id}, {"$set": update_dict})

    updated = await db.resumes.find_one({"id": resume_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])

    return Resume(**updated)

@api_router.delete("/resumes/{resume_id}")
async def delete_resume(resume_id: str, current_user: User = Depends(get_current_user)):
    result = await db.resumes.delete_one({"id": resume_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"message": "Resume deleted"}

# ========== ATS ROUTES ==========

ATS_SYSTEM_PROMPT = "You are an expert ATS (Applicant Tracking System) analyzer. Analyze resumes against job descriptions and provide a score (0-100), detailed feedback, strengths, and improvements. Return response in JSON format with keys: score, feedback, strengths (array), improvements (array)."

def build_ats_prompt(resume_text: str, job_description: str) -> str:
    return f"""Analyze this resume against the job description and provide:
1. ATS Score (0-100)
2. Overall feedback
3. List of strengths
4. List of improvements

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Provide response as JSON only."""


def parse_ai_response(response_text: str) -> dict:
    text = response_text.strip()
    if text.startswith('```json'):
        text = text.split('```json')[1].split('```')[0].strip()
    elif text.startswith('```'):
        text = text.split('```')[1].split('```')[0].strip()
    return json.loads(text)


async def call_gemini(prompt: str) -> dict:
    if gemini_client is None:
        raise RuntimeError("Gemini client is not initialized: GEMINI_API_KEY is missing or not set")
    response = await asyncio.to_thread(
        gemini_client.models.generate_content,
        model='gemini-2.0-flash',
        contents=f"{ATS_SYSTEM_PROMPT}\n\n{prompt}"
    )
    return parse_ai_response(response.text)


async def call_groq(prompt: str) -> dict:
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": ATS_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=2000
    )
    return parse_ai_response(response.choices[0].message.content)


@api_router.post("/ats/analyze", response_model=ATSAnalysis)
async def analyze_resume(request: ATSAnalysisRequest, current_user: User = Depends(get_current_user)):
    # Check usage limits
    if not current_user.is_premium and current_user.ats_checks_used >= current_user.ats_checks_limit:
        raise HTTPException(status_code=403, detail="ATS check limit reached. Upgrade to premium for unlimited checks.")

    # Get resume
    resume = await db.resumes.find_one({"id": request.resume_id, "user_id": current_user.id}, {"_id": 0})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Build resume text
    resume_text = f"Resume Title: {resume['title']}\n\n"
    for section in resume.get('sections', []):
        resume_text += f"{section['type'].upper()}:\n{section['content']}\n\n"

    prompt = build_ats_prompt(resume_text, request.job_description)

    # Call both AI models in parallel with graceful fallback
    gemini_result = None
    groq_result = None

    async def safe_call_gemini():
        nonlocal gemini_result
        try:
            gemini_result = await call_gemini(prompt)
        except Exception as e:
            logging.error(f"Gemini error: {str(e)}")

    async def safe_call_groq():
        nonlocal groq_result
        try:
            groq_result = await call_groq(prompt)
        except Exception as e:
            logging.error(f"Groq error: {str(e)}")

    await asyncio.gather(safe_call_gemini(), safe_call_groq())

    # Build analysis from dual results
    gemini_score = gemini_result.get('score', 0) if gemini_result else None
    groq_score = groq_result.get('score', 0) if groq_result else None

    # Compute combined average score
    scores = [s for s in [gemini_score, groq_score] if s is not None]
    combined_score = round(sum(scores) / len(scores)) if scores else 75

    # Pick best available feedback for top-level fields
    primary = gemini_result or groq_result
    if not primary:
        # Both failed — use fallback
        primary = {
            'feedback': "Your resume has been analyzed. Consider tailoring it more to the job description.",
            'strengths': ["Clear structure", "Professional formatting"],
            'improvements': ["Add more relevant keywords", "Quantify achievements"]
        }

    analysis = ATSAnalysis(
        user_id=current_user.id,
        resume_id=request.resume_id,
        job_description=request.job_description,
        score=combined_score,
        feedback=primary.get('feedback', ''),
        strengths=primary.get('strengths', []),
        improvements=primary.get('improvements', []),
        gemini_score=gemini_score,
        gemini_feedback=gemini_result.get('feedback', '') if gemini_result else None,
        gemini_strengths=gemini_result.get('strengths', []) if gemini_result else [],
        gemini_improvements=gemini_result.get('improvements', []) if gemini_result else [],
        groq_score=groq_score,
        groq_feedback=groq_result.get('feedback', '') if groq_result else None,
        groq_strengths=groq_result.get('strengths', []) if groq_result else [],
        groq_improvements=groq_result.get('improvements', []) if groq_result else [],
    )

    # Save analysis
    analysis_dict = analysis.model_dump()
    analysis_dict['created_at'] = analysis_dict['created_at'].isoformat()
    await db.ats_analyses.insert_one(analysis_dict)

    # Update user's usage count
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"ats_checks_used": 1}}
    )

    return analysis

@api_router.get("/ats/analyses", response_model=List[ATSAnalysis])
async def get_analyses(current_user: User = Depends(get_current_user)):
    analyses = await db.ats_analyses.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for analysis in analyses:
        if isinstance(analysis.get('created_at'), str):
            analysis['created_at'] = datetime.fromisoformat(analysis['created_at'])
    return analyses

# ========== PAYMENT ROUTES ==========

@api_router.post("/payments/checkout", response_model=CheckoutResponse)
async def create_checkout(current_user: User = Depends(get_current_user)):
    amount = 1999  # $19.99 in cents
    currency = "usd"

    success_url = f"{FRONTEND_URL}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{FRONTEND_URL}/pricing"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": currency,
                "product_data": {
                    "name": "CareerArchitect Premium",
                    "description": "Unlimited ATS checks, priority support, no ads"
                },
                "unit_amount": amount,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user.id,
            "product": "premium_subscription"
        }
    )

    # Save transaction
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.id,
        amount=19.99,
        currency=currency,
        status="initiated",
        payment_status="pending",
        metadata={"user_id": current_user.id, "product": "premium_subscription"}
    )

    transaction_dict = transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    await db.payment_transactions.insert_one(transaction_dict)

    return CheckoutResponse(session_id=session.id, url=session.url)

@api_router.get("/payments/status/{session_id}", response_model=PaymentStatusResponse)
async def get_payment_status(session_id: str, current_user: User = Depends(get_current_user)):
    session = stripe.checkout.Session.retrieve(session_id)

    # Update transaction if paid
    if session.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if transaction and transaction['payment_status'] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "status": "completed"}}
            )
            # Upgrade user to premium and reset usage
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"is_premium": True, "ats_checks_used": 0}}
            )

    return PaymentStatusResponse(
        session_id=session.id,
        status=session.status,
        payment_status=session.payment_status
    )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    try:
        event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logging.error(f"Webhook signature verification failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session["id"]
        payment_status = session.get("payment_status", "")

        if payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if transaction and transaction['payment_status'] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "completed"}}
                )
                # Upgrade user
                user_id = transaction.get('metadata', {}).get('user_id')
                if user_id:
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {"is_premium": True, "ats_checks_used": 0}}
                    )

    return {"status": "success"}

# ========== INCLUDE ROUTER ==========

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
