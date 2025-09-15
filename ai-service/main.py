from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import asyncio
import json

from services.chatbot_service import ChatbotService
from services.fraud_detection_service import FraudDetectionService
from services.nlp_service import NLPService
from services.model_service import ModelService
from database.database import get_database
from middleware.auth import verify_token
from middleware.rate_limiter import rate_limit
from utils.logger import setup_logger

# Load environment variables
load_dotenv()

# Setup logging
logger = setup_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="GlobalAi Payee AI Service",
    description="AI-powered chatbot and fraud detection service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Initialize services
chatbot_service = ChatbotService()
fraud_detection_service = FraudDetectionService()
nlp_service = NLPService()
model_service = ModelService()

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    intent: str
    confidence: float
    entities: List[Dict[str, Any]]
    suggestions: List[str]
    session_id: str

class FraudDetectionRequest(BaseModel):
    transaction_data: Dict[str, Any]
    user_id: str
    amount: float
    currency: str
    location: Optional[Dict[str, float]] = None
    device_info: Optional[Dict[str, Any]] = None

class FraudDetectionResponse(BaseModel):
    fraud_score: float
    risk_level: str
    reasons: List[str]
    recommendation: str
    confidence: float

class TransactionAnalysisRequest(BaseModel):
    transaction_id: str
    user_id: str
    transaction_data: Dict[str, Any]

class TransactionAnalysisResponse(BaseModel):
    category: str
    confidence: float
    tags: List[str]
    insights: List[str]
    recommendations: List[str]

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    services: Dict[str, str]
    models_loaded: bool

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        # Check if models are loaded
        models_loaded = await model_service.check_models_loaded()
        
        # Check service health
        services_status = {
            "chatbot": "healthy" if chatbot_service.is_ready() else "unhealthy",
            "fraud_detection": "healthy" if fraud_detection_service.is_ready() else "unhealthy",
            "nlp": "healthy" if nlp_service.is_ready() else "unhealthy",
            "models": "healthy" if models_loaded else "unhealthy"
        }
        
        overall_status = "healthy" if all(status == "healthy" for status in services_status.values()) else "degraded"
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.utcnow(),
            services=services_status,
            models_loaded=models_loaded
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )

# Chatbot endpoints
@app.post("/chat", response_model=ChatResponse)
@rate_limit(requests_per_minute=30)
async def chat(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Chat with AI assistant"""
    try:
        # Verify token
        user_data = verify_token(credentials.credentials)
        
        # Process chat request
        response = await chatbot_service.process_message(
            message=request.message,
            context=request.context,
            user_id=request.user_id or user_data.get("userId"),
            session_id=request.session_id
        )
        
        return ChatResponse(**response)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat request"
        )

@app.post("/chat/intent")
@rate_limit(requests_per_minute=60)
async def detect_intent(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Detect user intent from message"""
    try:
        verify_token(credentials.credentials)
        
        intent_data = await nlp_service.detect_intent(request.message)
        
        return {
            "intent": intent_data["intent"],
            "confidence": intent_data["confidence"],
            "entities": intent_data["entities"]
        }
    except Exception as e:
        logger.error(f"Intent detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to detect intent"
        )

# Fraud detection endpoints
@app.post("/fraud/detect", response_model=FraudDetectionResponse)
@rate_limit(requests_per_minute=100)
async def detect_fraud(
    request: FraudDetectionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Detect fraudulent transactions"""
    try:
        verify_token(credentials.credentials)
        
        fraud_result = await fraud_detection_service.analyze_transaction(
            transaction_data=request.transaction_data,
            user_id=request.user_id,
            amount=request.amount,
            currency=request.currency,
            location=request.location,
            device_info=request.device_info
        )
        
        return FraudDetectionResponse(**fraud_result)
    except Exception as e:
        logger.error(f"Fraud detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze transaction for fraud"
        )

@app.post("/fraud/batch-analyze")
@rate_limit(requests_per_minute=20)
async def batch_analyze_fraud(
    transactions: List[FraudDetectionRequest],
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Batch analyze multiple transactions for fraud"""
    try:
        verify_token(credentials.credentials)
        
        results = []
        for transaction in transactions:
            fraud_result = await fraud_detection_service.analyze_transaction(
                transaction_data=transaction.transaction_data,
                user_id=transaction.user_id,
                amount=transaction.amount,
                currency=transaction.currency,
                location=transaction.location,
                device_info=transaction.device_info
            )
            results.append(fraud_result)
        
        return {"results": results}
    except Exception as e:
        logger.error(f"Batch fraud analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to batch analyze transactions"
        )

# Transaction analysis endpoints
@app.post("/analyze/transaction", response_model=TransactionAnalysisResponse)
@rate_limit(requests_per_minute=50)
async def analyze_transaction(
    request: TransactionAnalysisRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Analyze transaction for categorization and insights"""
    try:
        verify_token(credentials.credentials)
        
        analysis = await nlp_service.analyze_transaction(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            transaction_data=request.transaction_data
        )
        
        return TransactionAnalysisResponse(**analysis)
    except Exception as e:
        logger.error(f"Transaction analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze transaction"
        )

@app.post("/analyze/sentiment")
@rate_limit(requests_per_minute=100)
async def analyze_sentiment(
    text: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Analyze sentiment of text"""
    try:
        verify_token(credentials.credentials)
        
        sentiment = await nlp_service.analyze_sentiment(text)
        
        return {
            "sentiment": sentiment["sentiment"],
            "confidence": sentiment["confidence"],
            "scores": sentiment["scores"]
        }
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze sentiment"
        )

# Model management endpoints
@app.post("/models/retrain")
@rate_limit(requests_per_minute=5)
async def retrain_models(
    model_type: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Retrain AI models"""
    try:
        verify_token(credentials.credentials)
        
        # Check if user has admin privileges
        user_data = verify_token(credentials.credentials)
        if user_data.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )
        
        result = await model_service.retrain_model(model_type)
        
        return {
            "message": f"Model {model_type} retraining initiated",
            "task_id": result.get("task_id"),
            "status": "started"
        }
    except Exception as e:
        logger.error(f"Model retraining error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrain model"
        )

@app.get("/models/status")
async def get_model_status(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get status of AI models"""
    try:
        verify_token(credentials.credentials)
        
        status = await model_service.get_model_status()
        
        return {"models": status}
    except Exception as e:
        logger.error(f"Model status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get model status"
        )

# Utility endpoints
@app.post("/extract/entities")
@rate_limit(requests_per_minute=100)
async def extract_entities(
    text: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Extract entities from text"""
    try:
        verify_token(credentials.credentials)
        
        entities = await nlp_service.extract_entities(text)
        
        return {"entities": entities}
    except Exception as e:
        logger.error(f"Entity extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract entities"
        )

@app.post("/summarize")
@rate_limit(requests_per_minute=30)
async def summarize_text(
    text: str,
    max_length: int = 100,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Summarize text"""
    try:
        verify_token(credentials.credentials)
        
        summary = await nlp_service.summarize_text(text, max_length)
        
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Text summarization error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to summarize text"
        )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting AI Service...")
    
    try:
        # Initialize database connection
        await get_database()
        
        # Load AI models
        await model_service.load_models()
        
        # Initialize services
        await chatbot_service.initialize()
        await fraud_detection_service.initialize()
        await nlp_service.initialize()
        
        logger.info("AI Service started successfully")
    except Exception as e:
        logger.error(f"Failed to start AI Service: {e}")
        raise

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down AI Service...")
    
    try:
        # Cleanup services
        await chatbot_service.cleanup()
        await fraud_detection_service.cleanup()
        await nlp_service.cleanup()
        await model_service.cleanup()
        
        logger.info("AI Service shut down successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True if os.getenv("ENVIRONMENT") == "development" else False,
        log_level="info"
    )