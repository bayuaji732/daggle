"""
Processing task — schema inference, preview generation, stats update.
Runs after ingestion marks a dataset READY.
"""

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.preview_service import PreviewService
import structlog

log = structlog.get_logger(__name__)


@celery_app.task(name="processing.generate_preview", bind=True, max_retries=3)
def generate_preview(self, dataset_id: int):
    """
    Generate and cache a preview for the dataset's primary file.
    For now stores result in logs; future: persist to DB or Redis cache.
    """
    db = SessionLocal()
    try:
        from app.models import Dataset
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            return {"status": "error", "detail": "Dataset not found"}

        preview_service = PreviewService()

        # Find the primary data file from the database version files
        from app.models import DatasetVersion, DatasetVersionFile
        version = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.is_latest == True
        ).first()
        if not version:
            return {"status": "skipped", "reason": "No version found"}

        version_files = db.query(DatasetVersionFile).filter(
            DatasetVersionFile.version_id == version.id
        ).all()

        data_extensions = {".csv", ".tsv", ".txt", ".json", ".jsonl", ".parquet", ".xlsx", ".xls"}
        data_files = [
            vf for vf in version_files
            if any(vf.logical_path.endswith(ext) for ext in data_extensions)
        ]

        if not data_files:
            log.warning("no_previewable_files", dataset_id=dataset_id)
            return {"status": "skipped", "reason": "No previewable data files found"}

        preview = preview_service.generate_preview(
            data_files[0].file_asset.storage_path, 
            filename=data_files[0].logical_path
        )
        log.info("preview_generated", dataset_id=dataset_id, type=preview.get("type"))
        return {"status": "done", "dataset_id": dataset_id, "preview_type": preview.get("type")}

    except Exception as exc:
        log.error("preview_failed", dataset_id=dataset_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()