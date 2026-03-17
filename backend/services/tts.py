"""
Text-to-Speech service using Microsoft Edge TTS (edge-tts library).
Completely free, neural-quality voices, no API key needed.
"""
import asyncio
import io
import logging
import os
import re
import tempfile
from typing import Optional

import edge_tts

logger = logging.getLogger(__name__)

VOICES = {
    "hi": "hi-IN-SwaraNeural",      # Hindi female — natural, clear
    "en": "en-IN-NeerjaNeural",     # Indian English female
}

# Split long text into chunks to avoid Edge TTS timeout
_MAX_TTS_CHARS = 500


def _split_into_sentences(text: str, max_chars: int = _MAX_TTS_CHARS) -> list[str]:
    """Split text on sentence boundaries, keeping each chunk ≤ max_chars."""
    # Split on .  !  ?  followed by space or end
    raw_sentences = re.split(r"(?<=[.!?।])\s+", text.strip())
    chunks: list[str] = []
    current = ""

    for sentence in raw_sentences:
        if not sentence.strip():
            continue
        if current and len(current) + len(sentence) + 1 > max_chars:
            chunks.append(current.strip())
            current = sentence
        else:
            current = (current + " " + sentence).strip() if current else sentence

    if current:
        chunks.append(current.strip())

    return chunks if chunks else [text[:max_chars]]


async def synthesize_speech(
    text: str, language: str, output_path: str
) -> str:
    """
    Synthesize text to speech and save as MP3.
    Handles long text by splitting into sentence chunks and concatenating.
    """
    voice = VOICES.get(language, VOICES["en"])

    if len(text) <= _MAX_TTS_CHARS:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
    else:
        # Split and concatenate MP3 bytes
        chunks = _split_into_sentences(text)
        mp3_parts: list[bytes] = []
        for chunk in chunks:
            communicate = edge_tts.Communicate(chunk, voice)
            tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
            tmp.close()
            await communicate.save(tmp.name)
            with open(tmp.name, "rb") as f:
                mp3_parts.append(f.read())
            os.unlink(tmp.name)

        with open(output_path, "wb") as out:
            for part in mp3_parts:
                out.write(part)

    return output_path


async def text_to_speech_bytes(text: str, language: str) -> bytes:
    """Synthesize text and return raw MP3 bytes."""
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        await synthesize_speech(text, language, tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
