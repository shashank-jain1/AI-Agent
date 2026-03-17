"""
RAG (Retrieval-Augmented Generation) pipeline.
Embeds the user query → searches Supabase pgvector → generates answer with Gemini.
"""
import os
import time
import logging
import asyncio
from typing import Optional

from google import genai

from services.embedder import generate_embedding
from db.supabase_client import get_db

logger = logging.getLogger(__name__)

_gemini_client = None

SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.40"))
TOP_K_CHUNKS = int(os.getenv("TOP_K_CHUNKS", "8"))

FALLBACK = {
    "en": (
        "I'm sorry, I couldn't find relevant information in the available documents. "
        "Please try rephrasing your question or contact support."
    ),
    "hi": (
        "मुझे खेद है, उपलब्ध दस्तावेज़ों में आपके प्रश्न से संबंधित जानकारी नहीं मिली। "
        "कृपया अपना प्रश्न दोबारा पूछें या सहायता से संपर्क करें।"
    ),
}

SYSTEM_PROMPT = """You are a helpful assistant. Answer the user's question using ONLY the \
document context provided. Do not use any outside knowledge whatsoever.
If the answer is not in the context, say you couldn't find it — don't guess.
Respond in the SAME language as the user's question:
- If the question is in Hindi → answer in Hindi
- If the question is in English → answer in English
Keep your response concise and helpful."""


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _gemini_client


def _log_query(
    query_text: str,
    language: str,
    response_text: str,
    chunks_used: int,
    response_time_ms: int,
    client_type: str,
    session_id: str,
):
    """Log query to analytics table asynchronously (fire-and-forget)."""
    try:
        get_db().table("query_logs").insert(
            {
                "query_text": query_text[:2000],
                "language": language,
                "response_text": response_text[:5000],
                "chunks_used": chunks_used,
                "response_time_ms": response_time_ms,
                "client_type": client_type,
                "session_id": session_id,
            }
        ).execute()
    except Exception as e:
        logger.warning(f"Failed to log query: {e}")


def answer_query(
    query: str,
    language: str,
    session_id: str,
    client_type: str = "web",
) -> dict:
    """
    Full RAG pipeline:
      1. Embed query
      2. Vector similarity search (chunks + FAQs)
      3. Build context
      4. Gemini completion
      5. Log to analytics
    """
    start_time = time.time()

    # Step 1: Embed the query
    query_embedding = generate_embedding(query)

    # Step 2: Vector search via Supabase RPC
    supabase = get_db()
    rpc_result = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": SIMILARITY_THRESHOLD,
            "match_count": TOP_K_CHUNKS,
        },
    ).execute()

    chunks = rpc_result.data or []

    # Normalize language to 'hi' or 'en'
    if language not in ("hi", "en"):
        language = "en"

    # Step 3: Handle no results
    if not chunks:
        logger.info(f"No relevant chunks found for: {query[:80]}")
        response_time_ms = int((time.time() - start_time) * 1000)
        answer = FALLBACK[language]
        _log_query(query, language, answer, 0, response_time_ms, client_type, session_id)
        return {
            "answer": answer,
            "language": language,
            "sources": [],
            "chunks_used": 0,
            "response_time_ms": response_time_ms,
        }

    # Step 4: Build context string
    context_parts = []
    sources = []
    for chunk in chunks:
        context_parts.append(
            f"Source: {chunk.get('filename', 'Unknown')} (Page {chunk.get('page_number', 1)})\n"
            f"{chunk.get('content', '')}\n---"
        )
        sources.append(
            {
                "filename": chunk.get("filename", "Unknown"),
                "page_number": chunk.get("page_number", 1),
                "similarity": round(float(chunk.get("similarity", 0)), 3),
            }
        )
    context = "\n\n".join(context_parts)

    # Step 5: Gemini completion
    client = _get_gemini_client()
    
    # Send system prompt and query as contents
    contents = f"System Instruction:\n{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {query}"
    
    completion = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=dict(temperature=0.1, max_output_tokens=1024)
    )

    answer = completion.text.strip() if completion.text else "No response generated."
    response_time_ms = int((time.time() - start_time) * 1000)

    # Step 6: Log async (fire-and-forget, don't block)
    _log_query(query, language, answer, len(chunks), response_time_ms, client_type, session_id)

    logger.info(
        f"RAG query answered in {response_time_ms}ms | "
        f"chunks={len(chunks)} | lang={language}"
    )

    return {
        "answer": answer,
        "language": language,
        "sources": sources,
        "chunks_used": len(chunks),
        "response_time_ms": response_time_ms,
    }
