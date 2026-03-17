import os
import logging
import redis
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

class AutoDictateRequest(BaseModel):
    auto_dictate: bool

@router.get("/auto_dictate")
def get_auto_dictate():
    """Get the global auto-dictate setting for the VoiceBot (Admin Config)."""
    try:
        val = redis_client.get("voicebot_auto_dictate")
        if val is None:
            return {"auto_dictate": True}
        return {"auto_dictate": val.lower() == "true"}
    except Exception as e:
        logger.warning(f"Failed to read auto_dictate from Redis: {e}")
        return {"auto_dictate": True}

@router.post("/auto_dictate")
def set_auto_dictate(request: AutoDictateRequest):
    """Set the global auto-dictate setting."""
    try:
        val = "true" if request.auto_dictate else "false"
        redis_client.set("voicebot_auto_dictate", val)
        return {"status": "success", "auto_dictate": request.auto_dictate}
    except Exception as e:
        logger.error(f"Failed to set auto_dictate in Redis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
