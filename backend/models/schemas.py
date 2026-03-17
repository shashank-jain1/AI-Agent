"""
Pydantic v2 schemas for request/response models.
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


# ── Documents ────────────────────────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    status: str = "queued"


class DocumentStatusResponse(BaseModel):
    status: str
    chunk_count: int = 0
    page_count: int = 0
    ocr_used: bool = False
    error_message: Optional[str] = None
    updated_at: Optional[str] = None


# ── FAQs ─────────────────────────────────────────────────────────────────────

class FAQCreateRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    answer: str = Field(..., min_length=3, max_length=5000)


class FAQUpdateRequest(BaseModel):
    question: Optional[str] = Field(None, min_length=3, max_length=1000)
    answer: Optional[str] = Field(None, min_length=3, max_length=5000)


class FAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    is_active: bool
    created_at: str


# ── Query ────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    language: str = Field("en", pattern="^(en|hi|auto)$")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_type: str = Field("web", pattern="^(web|mobile)$")


class SourceChunk(BaseModel):
    filename: str
    page_number: int
    similarity: float


class QueryResponse(BaseModel):
    answer: str
    language: str
    sources: list[SourceChunk] = []
    chunks_used: int = 0
    response_time_ms: int = 0


# ── STT / TTS ────────────────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    text: str
    language: str
    language_probability: float


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field("en", pattern="^(en|hi)$")


# ── Voice Query (unified) ─────────────────────────────────────────────────────

class VoiceQueryResponse(BaseModel):
    query: str           # transcribed text
    answer: str
    language: str
    sources: list[SourceChunk] = []
    chunks_used: int = 0
    response_time_ms: int = 0
    audio: Optional[str] = None          # base64-encoded MP3
    audio_format: str = "mp3"
