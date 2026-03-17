"""
FAQs router — CRUD with auto-embedding.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db.supabase_client import get_db
from models.schemas import FAQCreateRequest, FAQUpdateRequest, FAQResponse
from services.embedder import generate_embedding

router = APIRouter(prefix="/api/faqs", tags=["faqs"])
logger = logging.getLogger(__name__)

_security = HTTPBearer()


def _verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_security)):
    import httpx, os
    token = credentials.credentials
    supabase_url = os.getenv("SUPABASE_URL", "")
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    }
    resp = httpx.get(f"{supabase_url}/auth/v1/user", headers=headers, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()


def _compute_faq_embedding(question: str, answer: str) -> List[float]:
    combined = f"Q: {question}\nA: {answer}"
    return generate_embedding(combined)


@router.post("", response_model=FAQResponse)
def create_faq(body: FAQCreateRequest, user=Depends(_verify_jwt)):
    """Create a new FAQ with auto-generated embedding."""
    embedding = _compute_faq_embedding(body.question, body.answer)
    user_id = user.get("id")

    result = (
        get_db()
        .table("faqs")
        .insert(
            {
                "question": body.question,
                "answer": body.answer,
                "embedding": embedding,
                "is_active": True,
                "created_by": user_id,
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create FAQ")
    return FAQResponse(**result.data[0])


@router.get("", response_model=List[FAQResponse])
def list_faqs():
    """Public — list all active FAQs (for display in agent UI)."""
    result = (
        get_db()
        .table("faqs")
        .select("id,question,answer,is_active,created_at")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return [FAQResponse(**row) for row in (result.data or [])]


@router.put("/{faq_id}", response_model=FAQResponse)
def update_faq(faq_id: str, body: FAQUpdateRequest, user=Depends(_verify_jwt)):
    """Update FAQ question/answer and regenerate embedding."""
    supabase = get_db()

    # Get current values
    existing = supabase.table("faqs").select("*").eq("id", faq_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="FAQ not found")

    new_question = body.question or existing.data["question"]
    new_answer = body.answer or existing.data["answer"]
    new_embedding = _compute_faq_embedding(new_question, new_answer)

    result = (
        supabase.table("faqs")
        .update(
            {
                "question": new_question,
                "answer": new_answer,
                "embedding": new_embedding,
            }
        )
        .eq("id", faq_id)
        .execute()
    )
    return FAQResponse(**result.data[0])


@router.delete("/{faq_id}")
def delete_faq(faq_id: str, user=Depends(_verify_jwt)):
    """Soft delete — sets is_active=False to preserve analytics."""
    get_db().table("faqs").update({"is_active": False}).eq("id", faq_id).execute()
    return {"message": "FAQ deactivated"}
