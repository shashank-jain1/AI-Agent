"""
Voice router — STT + TTS + unified voice query endpoint.
Handles audio from both web (webm) and mobile (m4a) clients.
"""
import base64
import logging
import os
import tempfile
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from services import stt, tts, rag
from models.schemas import TranscribeResponse, SynthesizeRequest, VoiceQueryResponse

router = APIRouter(prefix="/api/voice", tags=["voice"])
logger = logging.getLogger(__name__)


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
):
    """Transcribe an uploaded audio file using Whisper STT."""
    ext = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp_input = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_input.close()
    tmp_wav.close()

    try:
        # Save uploaded file
        content = await audio.read()
        with open(tmp_input.name, "wb") as f:
            f.write(content)

        # Convert to 16kHz mono WAV
        stt.convert_audio_to_wav(tmp_input.name, tmp_wav.name)

        # Transcribe
        lang_param = language if language != "auto" else None
        result = stt.transcribe_audio(tmp_wav.name, lang_param)

        return TranscribeResponse(**result)

    except Exception as e:
        logger.exception(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        for p in [tmp_input.name, tmp_wav.name]:
            if os.path.exists(p):
                os.unlink(p)


@router.post("/synthesize")
async def synthesize_speech_endpoint(body: SynthesizeRequest):
    """Synthesize text to speech and return MP3 stream."""
    if len(body.text) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Text too long. Split into chunks of max 2000 chars.",
        )

    try:
        mp3_bytes = await tts.text_to_speech_bytes(body.text, body.language)
        return StreamingResponse(
            iter([mp3_bytes]),
            media_type="audio/mpeg",
            headers={"X-Language": body.language},
        )
    except Exception as e:
        logger.exception(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.post("/query", response_model=VoiceQueryResponse)
async def voice_query_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4())),
    client_type: str = Form("web"),
    tts_enabled: str = Form("true", alias="tts"),
):
    """
    Unified voice query endpoint:
    1. Transcribe audio → query text
    2. RAG: retrieve + GPT-4o answer
    3. TTS: synthesize answer audio (if tts=true)
    4. Return JSON with transcription, answer, sources, and base64 audio
    """
    ext = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp_input = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_input.close()
    tmp_wav.close()

    try:
        # Step 1: Save + convert audio
        content = await audio.read()
        with open(tmp_input.name, "wb") as f:
            f.write(content)
        stt.convert_audio_to_wav(tmp_input.name, tmp_wav.name)

        # Step 2: Transcribe
        lang_param = language if language != "auto" else None
        transcription = stt.transcribe_audio(tmp_wav.name, lang_param)
        query_text = transcription["text"]
        detected_language = transcription["language"]

        # Normalize language to 'en' or 'hi'
        if detected_language not in ("hi", "en"):
            detected_language = "en"

        if not query_text.strip():
            raise HTTPException(status_code=400, detail="No speech detected in audio.")

        # Step 3: RAG
        rag_result = rag.answer_query(
            query=query_text,
            language=detected_language,
            session_id=session_id,
            client_type=client_type,
        )

        # Step 4: TTS (optional)
        audio_b64: str | None = None
        if tts_enabled.lower() == "true":
            mp3_bytes = await tts.text_to_speech_bytes(
                rag_result["answer"], detected_language
            )
            audio_b64 = base64.b64encode(mp3_bytes).decode("utf-8")

        return VoiceQueryResponse(
            query=query_text,
            answer=rag_result["answer"],
            language=detected_language,
            sources=rag_result["sources"],
            chunks_used=rag_result["chunks_used"],
            response_time_ms=rag_result["response_time_ms"],
            audio=audio_b64,
            audio_format="mp3",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Voice query failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice query failed: {str(e)}")
    finally:
        for p in [tmp_input.name, tmp_wav.name]:
            if os.path.exists(p):
                os.unlink(p)
