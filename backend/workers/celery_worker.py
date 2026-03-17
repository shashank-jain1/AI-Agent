"""
Celery task worker for async document ingestion.
Run with: celery -A workers.celery_worker worker --loglevel=info --concurrency=2
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

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
)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    time_limit=600,
    name="workers.celery_worker.ingest_document_task",
)
def ingest_document_task(self, document_id: str, storage_path: str, file_type: str):
    """Async Celery task that wraps the ingestion pipeline."""
    try:
        from services.ingestion import ingest_document
        ingest_document(document_id, storage_path, file_type)
    except Exception as exc:
        raise self.retry(exc=exc)
