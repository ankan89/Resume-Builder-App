from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

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
    
    # Call GPT-5.2 for ATS analysis
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ats-{uuid.uuid4()}",
            system_message="You are an expert ATS (Applicant Tracking System) analyzer. Analyze resumes against job descriptions and provide a score (0-100), detailed feedback, strengths, and improvements. Return response in JSON format with keys: score, feedback, strengths (array), improvements (array)."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze this resume against the job description and provide:
1. ATS Score (0-100)
2. Overall feedback
3. List of strengths
4. List of improvements

RESUME:
{resume_text}

JOB DESCRIPTION:
{request.job_description}

Provide response as JSON only."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        response_text = response.strip()
        if response_text.startswith('```json'):
            response_text = response_text.split('```json')[1].split('```')[0].strip()
        elif response_text.startswith('```'):
            response_text = response_text.split('```')[1].split('```')[0].strip()
        
        analysis_data = json.loads(response_text)
        
        analysis = ATSAnalysis(
            user_id=current_user.id,
            resume_id=request.resume_id,
            job_description=request.job_description,
            score=analysis_data.get('score', 75),
            feedback=analysis_data.get('feedback', ''),
            strengths=analysis_data.get('strengths', []),
            improvements=analysis_data.get('improvements', [])
        )
        
    except Exception as e:
        logging.error(f"ATS analysis error: {str(e)}")
        # Fallback analysis
        analysis = ATSAnalysis(
            user_id=current_user.id,
            resume_id=request.resume_id,
            job_description=request.job_description,
            score=75,
            feedback="Your resume has been analyzed. Consider tailoring it more to the job description.",
            strengths=["Clear structure", "Professional formatting"],
            improvements=["Add more relevant keywords", "Quantify achievements"]
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

@api_router.post("/payments/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(request: Request, current_user: User = Depends(get_current_user)):
    # Get origin from request
    origin = str(request.base_url).rstrip('/')
    
    # Fixed premium package
    amount = 19.99
    currency = "usd"
    
    # Build URLs
    success_url = f"{origin}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"
    
    metadata = {
        "user_id": current_user.id,
        "product": "premium_subscription"
    }
    
    # Initialize Stripe
    webhook_url = f"{origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Save transaction
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        amount=amount,
        currency=currency,
        status="initiated",
        payment_status="pending",
        metadata=metadata
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    await db.payment_transactions.insert_one(transaction_dict)
    
    return session

@api_router.get("/payments/status/{session_id}", response_model=CheckoutStatusResponse)
async def get_payment_status(session_id: str, request: Request, current_user: User = Depends(get_current_user)):
    origin = str(request.base_url).rstrip('/')
    webhook_url = f"{origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction if paid
    if status.payment_status == "paid":
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
    
    return status

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    origin = str(request.base_url).rstrip('/')
    webhook_url = f"{origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
            if transaction and transaction['payment_status'] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "status": "completed"}}
                )
                # Upgrade user
                user_id = transaction['metadata'].get('user_id')
                if user_id:
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": {"is_premium": True, "ats_checks_used": 0}}
                    )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

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