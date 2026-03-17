"""
Document ingestion pipeline orchestrator.
Downloads from Supabase Storage → parses → OCR if needed → chunks → embeds → stores.
"""
import os
import shutil
import logging
import tempfile
from typing import Optional
import uuid

from db.supabase_client import get_db
from services import chunker, embedder
from services.parsers import pdf_parser, pptx_parser, docx_parser, image_parser

logger = logging.getLogger(__name__)

TMP_DIR = tempfile.gettempdir()


def _update_document_status(document_id: str, status: str, **extra_fields):
    """Helper to update documents table."""
    from datetime import datetime, timezone

    data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat(), **extra_fields}
    get_db().table("documents").update(data).eq("id", document_id).execute()
    logger.info(f"Document {document_id} → status={status}")


def _download_from_storage(storage_path: str, local_path: str):
    """Download a file from Supabase Storage bucket 'documents' to local_path."""
    supabase = get_db()
    with open(local_path, "wb") as f:
        response = supabase.storage.from_("documents").download(storage_path)
        f.write(response)


def ingest_document(document_id: str, storage_path: str, file_type: str):
    """
    Full pipeline:
      1. Download from Supabase Storage
      2. Parse (with OCR if needed)
      3. Chunk
      4. Embed (batch)
      5. Store chunks
      6. Update metadata
      7. Cleanup
    """
    work_dir = os.path.join(TMP_DIR, f"ingest_{document_id}")
    os.makedirs(work_dir, exist_ok=True)
    filename = os.path.basename(storage_path)
    local_path = os.path.join(work_dir, filename)

    try:
        # Step 1: Download
        logger.info(f"Downloading {storage_path} → {local_path}")
        _download_from_storage(storage_path, local_path)
        _update_document_status(document_id, "processing")

        # Step 2: Parse
        ocr_used = False
        if file_type == "pdf":
            pages, ocr_used = pdf_parser.extract_pdf_text(local_path)
        elif file_type == "pptx":
            pages = pptx_parser.extract_pptx_text(local_path)
        elif file_type == "docx":
            pages = docx_parser.extract_docx_text(local_path)
        elif file_type == "image":
            raw_pages = image_parser.extract_image_text(local_path)
            pages = raw_pages
            ocr_used = True
        else:
            raise ValueError(f"Unsupported file_type: {file_type}")

        if not pages:
            raise ValueError("No text content could be extracted from the document.")

        if ocr_used:
            _update_document_status(document_id, "ocr_processing")

        # Step 3: Chunk
        logger.info(f"Chunking {len(pages)} pages...")
        chunks = chunker.chunk_pages(pages)
        if not chunks:
            raise ValueError("Chunker produced 0 chunks — document may be empty.")

        # Step 4: Embed
        _update_document_status(document_id, "embedding")
        texts = [c["text"] for c in chunks]
        logger.info(f"Generating {len(texts)} embeddings...")
        embeddings = embedder.generate_embeddings_batch(texts)

        # Step 5: Store chunks
        logger.info(f"Inserting {len(chunks)} chunks into document_chunks...")
        supabase = get_db()
        rows = []
        for chunk, emb in zip(chunks, embeddings):
            rows.append(
                {
                    "document_id": document_id,
                    "chunk_index": chunk["chunk_index"],
                    "page_number": chunk["page_number"],
                    "content": chunk["text"],
                    "embedding": emb,
                    "metadata": {"file_type": file_type},
                }
            )

        # Insert in batches of 50 to avoid payload limits
        for i in range(0, len(rows), 50):
            supabase.table("document_chunks").insert(rows[i : i + 50]).execute()

        # Step 6: Update document record
        page_count = len(pages)
        chunk_count = len(chunks)
        _update_document_status(
            document_id,
            "indexed",
            page_count=page_count,
            chunk_count=chunk_count,
            ocr_used=ocr_used,
            error_message=None,
        )
        logger.info(
            f"✓ Document {document_id} indexed: {page_count} pages, {chunk_count} chunks"
        )

    except Exception as exc:
        logger.exception(f"Ingestion failed for {document_id}: {exc}")
        _update_document_status(
            document_id, "failed", error_message=str(exc)[:1000]
        )
        raise

    finally:
        # Step 7: Cleanup
        if os.path.exists(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)
