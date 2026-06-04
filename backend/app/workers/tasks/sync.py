"""
Sync task — future Kubeflow PVC sync / storage housekeeping.
Placeholder for MVP; real implementation added when Kubeflow integration begins.
"""

from app.workers.celery_app import celery_app
import structlog

log = structlog.get_logger(__name__)


@celery_app.task(name="sync.storage_sync", bind=True)
def storage_sync(self, dataset_id: int):
    """
    Sync dataset files to a PVC-mounted path for Kubeflow notebook access.

    MVP: no-op placeholder.
    Future: copy datasets/<slug>/vN/ → /mnt/datasets/<slug>/
    """
    log.info("sync_noop", dataset_id=dataset_id, note="PVC sync not yet implemented")
    return {
        "status": "noop",
        "dataset_id": dataset_id,
        "message": "PVC sync not yet implemented — coming with Kubeflow integration",
    }