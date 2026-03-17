"""
Token-aware text chunker using tiktoken (cl100k_base, same as GPT-4).
"""
import os
import logging
from typing import List, Dict

import tiktoken

logger = logging.getLogger(__name__)

MAX_CHUNK_SIZE = int(os.getenv("MAX_CHUNK_SIZE", "900"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))

_encoder = None


def _get_encoder() -> tiktoken.Encoding:
    global _encoder
    if _encoder is None:
        _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def _count_tokens(text: str) -> int:
    return len(_get_encoder().encode(text))


def _get_last_overlap_tokens(text: str, overlap: int) -> str:
    """Return the last `overlap` tokens of text as a string."""
    enc = _get_encoder()
    tokens = enc.encode(text)
    overlap_tokens = tokens[-overlap:] if len(tokens) > overlap else tokens
    return enc.decode(overlap_tokens)


def chunk_text(text: str, page_number: int = 1) -> List[Dict]:
    """
    Split text into chunks of at most MAX_CHUNK_SIZE tokens.
    Uses paragraph boundaries for natural splits; overlaps by CHUNK_OVERLAP tokens.
    Returns list of: {text, chunk_index, page_number}
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_text = ""
    chunk_index = 0

    for para in paragraphs:
        candidate = (current_text + "\n\n" + para).strip() if current_text else para
        if _count_tokens(candidate) <= MAX_CHUNK_SIZE:
            current_text = candidate
        else:
            # Save current chunk if non-empty
            if current_text:
                chunks.append(
                    {
                        "text": current_text,
                        "chunk_index": chunk_index,
                        "page_number": page_number,
                    }
                )
                chunk_index += 1
                # Start new chunk with overlap from previous
                overlap_seed = _get_last_overlap_tokens(current_text, CHUNK_OVERLAP)
                current_text = (overlap_seed + "\n\n" + para).strip()
            else:
                # Single paragraph exceeds limit — split forcefully by sentences
                sentences = para.replace(". ", ".\n").split("\n")
                for sent in sentences:
                    candidate2 = (
                        (current_text + " " + sent).strip() if current_text else sent
                    )
                    if _count_tokens(candidate2) <= MAX_CHUNK_SIZE:
                        current_text = candidate2
                    else:
                        if current_text:
                            chunks.append(
                                {
                                    "text": current_text,
                                    "chunk_index": chunk_index,
                                    "page_number": page_number,
                                }
                            )
                            chunk_index += 1
                        current_text = sent

    if current_text:
        chunks.append(
            {
                "text": current_text,
                "chunk_index": chunk_index,
                "page_number": page_number,
            }
        )

    logger.debug(f"Page {page_number}: produced {len(chunks)} chunks")
    return chunks


def chunk_pages(pages: List[Dict]) -> List[Dict]:
    """
    Process a list of {page_number, text} dicts and return all chunks
    with correct page_number metadata.
    """
    all_chunks: List[Dict] = []
    global_index = 0
    for page in pages:
        page_chunks = chunk_text(page["text"], page_number=page["page_number"])
        for c in page_chunks:
            c["chunk_index"] = global_index
            global_index += 1
        all_chunks.extend(page_chunks)
    return all_chunks
