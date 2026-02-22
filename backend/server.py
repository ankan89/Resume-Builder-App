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
from passlib.context import CryptContext
import google.generativeai as genai
from groq import AsyncGroq
import stripe
import certifi
import ssl

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    tls=True,
    tlsCAFile=certifi.where(),
    tlsAllowInvalidCertificates=False,
    serverSelectionTimeoutMS=10000,
)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
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
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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

# ========== AUTH HELPERS ==========

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

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
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = await asyncio.to_thread(
        model.generate_content,
        f"{ATS_SYSTEM_PROMPT}\n\n{prompt}"
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
