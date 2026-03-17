"""
Speech-to-Text service using faster-whisper (CTranslate2 optimized Whisper).
Uses int8 quantization for CPU efficiency.
Model is loaded ONCE at startup via load_model().
"""
import os
import subprocess
import logging
import tempfile
import uuid
from typing import Optional, Dict

logger = logging.getLogger(__name__)

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small")

_model = None


def load_model():
    """Load the Whisper model into memory. Called once on FastAPI startup."""
    global _model
    if _model is not None:
        logger.info("Whisper model already loaded.")
        return

    from faster_whisper import WhisperModel

    logger.info(f"Loading Whisper model: {WHISPER_MODEL_NAME} (int8, CPU)...")
    _model = WhisperModel(
        WHISPER_MODEL_NAME,
        device="cpu",
        compute_type="int8",
    )
    logger.info("✓ Whisper model loaded successfully.")


def _get_model():
    global _model
    if _model is None:
        load_model()
    return _model


def convert_audio_to_wav(input_path: str, output_path: str):
    """
    Convert any audio format to 16kHz mono WAV using ffmpeg.
    Whisper works best with 16kHz mono WAV regardless of input format.
    """
    cmd = [
        "ffmpeg",
        "-y",                   # overwrite output
        "-i", input_path,
        "-ar", "16000",         # 16kHz sample rate
        "-ac", "1",             # mono
        "-f", "wav",
        output_path,
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg conversion failed: {result.stderr[:500]}"
        )


def transcribe_audio(
    audio_path: str, language: Optional[str] = None
) -> Dict:
    """
    Transcribe audio to text using Whisper.

    Args:
        audio_path: Path to WAV audio file (16kHz mono preferred).
        language: 'hi', 'en', or None/'auto' for auto-detection.

    Returns:
        {text, language, language_probability}
    """
    model = _get_model()

    # Determine language parameter for faster-whisper
    force_lang: Optional[str] = None
    if language and language not in ("auto", ""):
        force_lang = language

    segments, info = model.transcribe(
        audio_path,
        language=force_lang,
        beam_size=5,
        vad_filter=True,            # skip silence segments
        vad_parameters={"min_silence_duration_ms": 500},
    )

    full_text = " ".join([seg.text for seg in segments]).strip()

    return {
        "text": full_text,
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
    }


def is_model_loaded() -> bool:
    return _model is not None
