"""
Ingestion task — moves files from staging → datasets bucket,
extracts ZIPs, counts files, updates dataset status.
"""

import os
import zipfile
import tempfile

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import DatasetStatus
from app.services.dataset_service import DatasetService
from app.services.storage_service import StorageService
import structlog

log = structlog.get_logger(__name__)


@celery_app.task(name="ingestion.process_upload", bind=True, max_retries=3)
def process_upload(self, dataset_id: int, changelog: str = "Initial upload"):
    """
    Called after a file is uploaded to the staging bucket.
    1. Download file from staging
    2. If ZIP → extract, count files, upload each file
    3. Move to datasets bucket under datasets/<slug>/v1/
    4. Update Dataset status → READY (or FAILED)
    """
    db = SessionLocal()
    try:
        dataset_service = DatasetService(db)
        storage = StorageService()

        from app.models import Dataset
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            log.error("ingestion_dataset_not_found", dataset_id=dataset_id)
            return {"status": "error", "detail": "Dataset not found"}

        dataset_service.set_status(dataset_id, DatasetStatus.PROCESSING)
        staging_key = dataset.storage_path

        # Download from staging to temp file
        suffix = os.path.splitext(staging_key)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        try:
            if not storage.download_file(staging_key, tmp_path, bucket=storage.bucket_staging):
                raise RuntimeError("Failed to download from staging")

            import hashlib
            import mimetypes
            from app.models import DatasetVersion, FileAsset, DatasetVersionFile

            # 1. Collect files to process (fpath, logical_path)
            files_to_process = []
            temp_dir = None

            if suffix.lower() == ".zip":
                temp_dir = tempfile.TemporaryDirectory()
                with zipfile.ZipFile(tmp_path, "r") as zf:
                    zf.extractall(temp_dir.name)
                for root, _, files in os.walk(temp_dir.name):
                    for fname in files:
                        fpath = os.path.join(root, fname)
                        rel = os.path.relpath(fpath, temp_dir.name)
                        # Normalize backslashes to forward-slashes for cross-platform compatibility
                        logical_path = rel.replace("\\", "/")
                        files_to_process.append((fpath, logical_path))
            else:
                fname = os.path.basename(staging_key)
                if fname.startswith("staging_"):
                    fname = fname[8:]
                files_to_process.append((tmp_path, fname))

            # 2. Process each file and resolve FileAsset
            file_count = 0
            total_bytes = 0
            file_types = set()
            version_files_mappings = []

            for fpath, logical_path in files_to_process:
                # Compute SHA-256 hash
                h = hashlib.sha256()
                with open(fpath, "rb") as f:
                    while chunk := f.read(8192):
                        h.update(chunk)
                sha256 = h.hexdigest()
                size_bytes = os.path.getsize(fpath)

                # Check if FileAsset already exists in database
                asset = db.query(FileAsset).filter(FileAsset.sha256 == sha256).first()
                if not asset:
                    # Upload to CAS path: files/{sha256}
                    storage_path = f"files/{sha256}"
                    if not storage.upload_file(fpath, storage_path):
                        raise RuntimeError(f"Failed to upload file asset {logical_path} to storage")

                    # Record asset
                    asset = FileAsset(
                        sha256=sha256,
                        size_bytes=size_bytes,
                        storage_path=storage_path
                    )
                    db.add(asset)
                    db.commit()
                    db.refresh(asset)

                version_files_mappings.append((logical_path, asset))
                total_bytes += size_bytes
                file_count += 1

                mtype, _ = mimetypes.guess_type(logical_path)
                if not mtype:
                    mtype = os.path.splitext(logical_path)[1].lower().strip('.')
                if mtype:
                    file_types.add(mtype)



            # 3. Create DatasetVersion
            # Find the next version number
            existing_versions = db.query(DatasetVersion).filter(
                DatasetVersion.dataset_id == dataset.id
            ).all()
            
            next_version_num = 1
            for v in existing_versions:
                if v.version.startswith("v"):
                    try:
                        num = int(v.version[1:])
                        if num >= next_version_num:
                            next_version_num = num + 1
                    except ValueError:
                        pass
                
                # Deactivate previous latest
                if v.is_latest:
                    v.is_latest = False

            db.commit()

            version_str = f"v{next_version_num}"
            dataset_version = DatasetVersion(
                dataset_id=dataset.id,
                version=version_str,
                description=dataset.description or "Dataset upload",
                changelog=changelog,
                storage_path=f"datasets/{dataset.slug}/{version_str}",
                size_bytes=total_bytes,
                file_count=file_count,
                is_latest=True
            )
            db.add(dataset_version)
            db.commit()
            db.refresh(dataset_version)

            # --- KAGGLE-STYLE INFRASTRUCTURE MOUNT PREPARATION ---
            # Copy the extracted files into the shared extracted_datasets volume
            # so JupyterHub can bind-mount them directly as read-only.
            import shutil
            extract_target_dir = f"/extracted_datasets/{dataset.slug}/{version_str}"
            os.makedirs(extract_target_dir, exist_ok=True)
            
            if temp_dir:
                # Copy the whole unzipped directory structure
                shutil.copytree(temp_dir.name, extract_target_dir, dirs_exist_ok=True)
            else:
                # Copy the single file
                fname = os.path.basename(staging_key)
                if fname.startswith("staging_"):
                    fname = fname[8:]
                shutil.copy2(tmp_path, os.path.join(extract_target_dir, fname))

            # Clean extraction folder if one was created
            if temp_dir:
                try:
                    temp_dir.cleanup()
                except Exception:
                    pass

            # --- FIX: Ensure notebook user (jovyan, uid=1000) can read the dataset ---
            # The Celery worker runs as root. Directories created by root default to
            # mode 700 (drwx------), which blocks any other uid from entering.
            # We must explicitly set world-readable permissions so the bind-mounted
            # directory is accessible inside the JupyterHub notebook container.
            os.chmod(extract_target_dir, 0o755)
            for dirpath, dirnames, filenames in os.walk(extract_target_dir):
                for d in dirnames:
                    os.chmod(os.path.join(dirpath, d), 0o755)
                for f in filenames:
                    os.chmod(os.path.join(dirpath, f), 0o644)
            log.info("dataset_permissions_set", path=extract_target_dir)

            # 4. Associate files with this version
            for logical_path, asset in version_files_mappings:
                version_file = DatasetVersionFile(
                    version_id=dataset_version.id,
                    file_asset_id=asset.id,
                    logical_path=logical_path
                )
                db.add(version_file)
            db.commit()

            # Clean staging
            storage.delete_file(staging_key, bucket=storage.bucket_staging)

            # Update DB master record
            dataset_service.update_dataset(dataset, {
                "storage_path": dataset_version.storage_path,
                "total_size_bytes": total_bytes,
                "file_count": file_count,
                "file_types": ",".join(filter(None, file_types)),
                "status": DatasetStatus.READY,
            })

            # Trigger preview generation task
            try:
                from app.workers.tasks.processing import generate_preview
                generate_preview.apply_async(args=[dataset_id], queue="processing")
            except Exception as e:
                log.error("failed_to_trigger_preview", dataset_id=dataset_id, error=str(e))

            log.info("ingestion_complete", dataset_id=dataset_id, files=file_count)
            return {"status": "ready", "dataset_id": dataset_id, "file_count": file_count}

        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


    except Exception as exc:
        log.error("ingestion_failed", dataset_id=dataset_id, error=str(exc))
        try:
            dataset_service.set_status(dataset_id, DatasetStatus.FAILED)
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=30)
    finally:
        db.close()