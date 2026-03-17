"""
Gemini Embeddings service — text-embedding-004 (768 dims, padded to 1536).
"""
import os
import logging
from typing import List
from google import genai
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

logger = logging.getLogger(__name__)

_client = None

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMS = 1536  # Retained for database compatibility (padded)
BATCH_SIZE = 100


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def _clean_text(text: str) -> str:
    """Strip and normalize whitespace, cap at 8000 chars."""
    import re
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text[:8000]


def _reshape_embedding(embedding: List[float]) -> List[float]:
    """Reshape embedding to 1536-dim to keep database compatibility."""
    # Truncate if too long (e.g. gemini-embedding-001 is 3072)
    if len(embedding) > EMBEDDING_DIMS:
        embedding = embedding[:EMBEDDING_DIMS]
    # Pad if too short
    elif len(embedding) < EMBEDDING_DIMS:
        embedding.extend([0.0] * (EMBEDDING_DIMS - len(embedding)))
    return embedding


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(4),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def generate_embedding(text: str) -> List[float]:
    """Generate a single embedding vector for the given text."""
    cleaned = _clean_text(text)
    if not cleaned:
        return [0.0] * EMBEDDING_DIMS
    
    response = _get_client().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=cleaned,
    )
    return _reshape_embedding(response.embeddings[0].values)


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts in batches of 100."""
    all_embeddings: List[List[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = [_clean_text(t) for t in texts[i : i + BATCH_SIZE]]
        safe_batch = [t if t else "empty" for t in batch]
        logger.info(f"Embedding batch {i // BATCH_SIZE + 1} ({len(safe_batch)} items)")
        
        response = _get_client().models.embed_content(
            model=EMBEDDING_MODEL,
            contents=safe_batch,
        )
        all_embeddings.extend([_reshape_embedding(item.values) for item in response.embeddings])
        
    return all_embeddings

