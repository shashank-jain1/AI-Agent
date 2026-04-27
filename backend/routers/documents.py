"""
Documents router — upload, list, status polling, delete, reindex.
All mutation endpoints require a valid Supabase JWT in Authorization header.
"""
import logging
import os
import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db.supabase_client import get_db
from models.schemas import DocumentUploadResponse, DocumentStatusResponse
from workers.celery_worker import ingest_document_task

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger(__name__)

_security = HTTPBearer()

# Allowed MIME types / extensions
_ALLOWED_EXTENSIONS = {"pdf", "pptx", "docx", "png", "jpg", "jpeg", "tiff", "webp"}
_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "tiff", "webp", "bmp"}
_MAX_FILE_SIZE_MB = 50


def _extension_to_filetype(ext: str) -> str:
    if ext in _IMAGE_EXTENSIONS:
        return "image"
    return ext  # pdf, pptx, docx


def _verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_security)):
    """
    Verify the Supabase JWT by calling the Supabase /auth/v1/user endpoint.
    Returns user dict on success; raises 401 on failure.
    """
    import httpx
    token = credentials.credentials
    supabase_url = os.getenv("SUPABASE_URL", "")
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    }
    try:
        resp = httpx.get(f"{supabase_url}/auth/v1/user", headers=headers, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth check failed: {e}")


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(_verify_jwt),
):
    """Upload a document to Supabase Storage and queue ingestion."""
    # Validate extension
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Allowed: {_ALLOWED_EXTENSIONS}",
        )

    # Read and validate size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > _MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413, detail=f"File too large ({size_mb:.1f} MB). Max {_MAX_FILE_SIZE_MB} MB."
        )

    # Sanitize filename
    from slugify import slugify
    base = filename.rsplit(".", 1)[0]
    safe_base = slugify(base, separator="_") or "document"
    safe_filename = f"{safe_base}.{ext}"

    # Generate document UUID
    doc_id = str(_uuid.uuid4())
    storage_path = f"{doc_id}/{safe_filename}"

    supabase = get_db()

    # Upload to Supabase Storage
    try:
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    # Insert document record
    file_type = _extension_to_filetype(ext)
    user_id = user.get("id")
    insert_result = supabase.table("documents").insert(
        {
            "id": doc_id,
            "filename": safe_filename,
            "original_name": filename,
            "file_type": file_type,
            "storage_path": storage_path,
            "status": "queued",
            "uploaded_by": user_id,
        }
    ).execute()

    # Trigger async Celery task
    ingest_document_task.delay(doc_id, storage_path, file_type)

    return DocumentUploadResponse(
        document_id=doc_id, filename=safe_filename, status="queued"
    )


@router.get("")
def list_documents(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user=Depends(_verify_jwt),
):
    """List all documents with optional status and search filters."""
    query = get_db().table("documents").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if search:
        query = query.ilike("original_name", f"%{search}%")
    result = query.execute()
    return result.data


@router.get("/public")
def list_public_documents():
    """Public endpoint — returns id, filename, original_name for all indexed documents.
    Used by the frontend chat page to show the document selection picker (no auth required)."""
    result = (
        get_db()
        .table("documents")
        .select("id,filename,original_name")
        .eq("status", "indexed")
        .order("original_name")
        .execute()
    )
    return result.data or []



@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
def get_document_status(document_id: str):
    """Public polling endpoint — used by admin UI for real-time status."""
    result = (
        get_db()
        .table("documents")
        .select("status,chunk_count,page_count,ocr_used,error_message,updated_at")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentStatusResponse(**result.data)


@router.delete("/{document_id}")
def delete_document(document_id: str, user=Depends(_verify_jwt)):
    """Delete a document: chunks (CASCADE), storage, and record."""
    supabase = get_db()

    # Get storage path first
    result = (
        supabase.table("documents")
        .select("storage_path")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = result.data["storage_path"]

    # Delete from storage
    try:
        supabase.storage.from_("documents").remove([storage_path])
    except Exception as e:
        logger.warning(f"Storage delete failed (continuing): {e}")

    # Delete DB record (chunks cascade)
    supabase.table("documents").delete().eq("id", document_id).execute()
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/reindex")
def reindex_document(document_id: str, user=Depends(_verify_jwt)):
    """Delete existing chunks, reset status, and re-queue ingestion."""
    supabase = get_db()

    result = (
        supabase.table("documents")
        .select("storage_path,file_type")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = result.data["storage_path"]
    file_type = result.data["file_type"]

    # Delete existing chunks
    supabase.table("document_chunks").delete().eq("document_id", document_id).execute()

    # Reset status
    from datetime import datetime, timezone
    supabase.table("documents").update(
        {"status": "queued", "chunk_count": 0, "error_message": None,
         "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", document_id).execute()

    # Re-queue
    ingest_document_task.delay(document_id, storage_path, file_type)
    return {"message": "Document re-queued for indexing"}
