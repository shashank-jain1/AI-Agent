"""
FastAPI application entry point.
- CORS configured for web + mobile
- All routers registered
- Whisper preloaded on startup
- Global exception handler
- Rate limiter middleware
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from routers import voice, query, documents, faqs, settings
from services import stt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])

app = FastAPI(
    title="VoiceBot RAG API",
    description="Multilingual (Hindi + English) RAG AI Voice Agent",
    version="1.0.0",
)

# Rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow specific origins for dev 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(voice.router)
app.include_router(query.router)
app.include_router(documents.router)
app.include_router(faqs.router)
app.include_router(settings.router)


# ── Startup: preload Whisper ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Starting VoiceBot API...")
    try:
        stt.load_model()
        logger.info("✓ Whisper model ready")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "whisper_loaded": stt.is_model_loaded(),
        "version": "1.0.0",
    }


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )
