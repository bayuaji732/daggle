from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "daggle_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.ingestion",
        "app.workers.tasks.processing",
        "app.workers.tasks.sync",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,       # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    task_routes={
        "app.workers.tasks.ingestion.*": {"queue": "ingestion"},
        "app.workers.tasks.processing.*": {"queue": "processing"},
        "app.workers.tasks.sync.*": {"queue": "sync"},
    },
)
