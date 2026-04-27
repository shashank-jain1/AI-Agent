"""
Celery task worker for async document ingestion.
Run with: celery -A workers.celery_worker:celery_app worker --loglevel=info --pool=solo
"""
import os
import sys

# ---------------------------------------------------------------------------
# Path bootstrap — MUST happen before any local imports.
# workers/celery_worker.py is at …/backend/workers/celery_worker.py
# Two dirname() calls → …/backend/  which contains services/, db/, etc.
# ---------------------------------------------------------------------------
_THIS_FILE = os.path.abspath(__file__)      # …/backend/workers/celery_worker.py
BACKEND_DIR = os.path.dirname(os.path.dirname(_THIS_FILE))   # …/backend/

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from celery import Celery
from dotenv import load_dotenv

# Load .env from backend/ explicitly — works regardless of CWD.
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "voicebot",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Windows does not support fork()-based prefork pool.
    # Use "solo" pool so tasks run in the worker process itself,
    # which avoids the "not enough values to unpack" _loc error.
    worker_pool="solo",
)

# ---------------------------------------------------------------------------
# Import ingestion at MODULE LEVEL so it succeeds in Celery's import context.
# Lazy imports inside task bodies can fail because Celery reinitialises the
# import system when dispatching — putting it here guarantees sys.path is
# already patched before the import runs.
# ---------------------------------------------------------------------------
from services.ingestion import ingest_document  # noqa: E402


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    time_limit=600,
    name="workers.celery_worker.ingest_document_task",
)
def ingest_document_task(self, document_id: str, storage_path: str, file_type: str):
    """Async Celery task that wraps the ingestion pipeline."""
    # Belt-and-suspenders: ensure path is set even if Celery rebuilt sys.path
    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)
    try:
        ingest_document(document_id, storage_path, file_type)
    except Exception as exc:
        raise self.retry(exc=exc)
