"""
Text query router — text-in, text/audio-out, rate limited.
"""
import logging

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from services import rag, tts
from models.schemas import QueryRequest, QueryResponse, SynthesizeRequest

router = APIRouter(prefix="/api/query", tags=["query"])
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=QueryResponse)
@limiter.limit("15/minute")
async def text_query(request: Request, body: QueryRequest):
    """Text-only RAG query. Rate limited to 15 req/min per IP."""
    try:
        result = rag.answer_query(
            query=body.query,
            language=body.language if body.language != "auto" else "en",
            session_id=body.session_id,
            client_type=body.client_type,
        )
        return QueryResponse(**result)
    except Exception as e:
        logger.exception(f"Text query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts")
async def query_tts(body: SynthesizeRequest):
    """Get TTS audio for any text — used after text query."""
    try:
        mp3_bytes = await tts.text_to_speech_bytes(body.text, body.language)
        return StreamingResponse(
            iter([mp3_bytes]),
            media_type="audio/mpeg",
            headers={"X-Language": body.language},
        )
    except Exception as e:
        logger.exception(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
