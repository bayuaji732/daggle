"""
Dataset API router.

Auth pattern:
  - CurrentUser  → Annotated[dict, Depends(get_current_user)]  (requires login)
  - OptionalUser → Annotated[dict | None, Depends(get_current_user_or_none)] (public access ok)

The `user` dict has keys: sub, username, email, name, roles, email_verified
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Query, Form, BackgroundTasks
from fastapi.responses import RedirectResponse, FileResponse
from typing import Optional
import os
import tempfile
import json
from pydantic import ValidationError

from app.api.deps import CurrentUser, OptionalUser, DbSession
from app.api.schemas import (
    DatasetCreate, DatasetUpdate,
    DatasetResponse, DatasetListResponse,
    PreviewResponse, ErrorResponse, DatasetSummaryResponse,
    FileListResponse,
)
from app.models import DatasetVisibility, DatasetStatus, Dataset, DatasetVersion, User, DatasetVersionFile
from app.services.dataset_service import DatasetService
from app.services.storage_service import StorageService
from app.services.preview_service import PreviewService
from app.workers.tasks.ingestion import process_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {
    ".zip", 
    ".csv", ".tsv", ".json", ".jsonl", ".parquet", ".xlsx", ".xls", ".txt",
    ".pdf", ".docx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".mp3", ".wav", ".flac", ".ogg",
    ".mp4", ".avi", ".mov", ".mkv"
}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB


def _get_or_create_local_user(db, user: dict):
    """
    Ensure a local User shadow record exists for the Keycloak identity.
    Called on any authenticated write operation.
    """
    local = db.query(User).filter(User.keycloak_id == user["sub"]).first()
    if not local:
        local = User(
            keycloak_id=user["sub"],
            username=user.get("username") or user["sub"],
            email=user.get("email") or "",
            display_name=user.get("name"),
        )
        db.add(local)
        db.commit()
        db.refresh(local)
    return local


from sqlalchemy.exc import IntegrityError

@router.post("/", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    dataset_create: str = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Upload and register a new dataset."""
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    try:
        metadata = json.loads(dataset_create)
        dataset_create_obj = DatasetCreate(**metadata)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON format in dataset_create field."
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e.errors())
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 500 MB limit.",
        )

    local_user = _get_or_create_local_user(db, user)
    dataset_service = DatasetService(db)
    storage_service = StorageService()

    # Upload to staging bucket
    staging_key = f"{user['sub']}/{dataset_create_obj.slug}/{file.filename}"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        storage_service.upload_to_staging(tmp_path, staging_key)
    finally:
        os.unlink(tmp_path)

    # Create DB record (status=PENDING, worker will process)
    tags_str = ",".join(dataset_create_obj.tags) if dataset_create_obj.tags else None
    
    try:
        dataset = dataset_service.create_dataset(
            name=dataset_create_obj.name,
            slug=dataset_create_obj.slug,
            description=dataset_create_obj.description,
            visibility=dataset_create_obj.visibility,
            owner_id=local_user.id,
            tags=tags_str,
            storage_path=staging_key,
            total_size_bytes=len(content),
        )
    except IntegrityError:
        db.rollback()
        storage_service.delete_file(staging_key, bucket=storage_service.bucket_staging)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A dataset with this name already exists. Please choose a different name, or go to your existing dataset to upload a new version."
        )

    # Trigger background ingestion task
    process_upload.apply_async(args=[dataset.id, "Initial upload"], queue="ingestion")

    return DatasetResponse.model_validate(dataset)


@router.post("/{slug}/versions", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset_version(
    slug: str,
    changelog: str = Form("New version upload"),
    file: UploadFile = File(...),
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Upload a new version of an existing dataset."""
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    dataset_service = DatasetService(db)
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    owner = db.query(User).filter(User.id == dataset.owner_id).first()
    if not owner or owner.keycloak_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the owner can upload a new version.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 500 MB limit.",
        )

    storage_service = StorageService()
    staging_key = f"{user['sub']}/{dataset.slug}/staging_{file.filename}"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        storage_service.upload_to_staging(tmp_path, staging_key)
    finally:
        os.unlink(tmp_path)

    # Update dataset storage path to point to new staging file and set to PROCESSING
    dataset = dataset_service.update_dataset(dataset, {
        "storage_path": staging_key,
        "status": DatasetStatus.PROCESSING
    })

    # Trigger background ingestion task
    process_upload.apply_async(args=[dataset.id, changelog], queue="ingestion")

    return DatasetResponse.model_validate(dataset)


@router.get("/", response_model=DatasetListResponse)
async def list_datasets(
    search: Optional[str] = Query(None, max_length=100),
    visibility: Optional[DatasetVisibility] = None,
    mine_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: OptionalUser = None,
    db: DbSession = None,
):
    """List datasets. Public datasets visible to all; private only to owner."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    is_admin = "admin" in user.get("roles", []) if user else False
    items, total = dataset_service.list_datasets(
        search=search,
        visibility_filter=visibility,
        user_keycloak_id=user_keycloak_id,
        mine_only=mine_only,
        is_admin=is_admin,
        page=page,
        page_size=page_size,
    )
    return DatasetListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/summary", response_model=DatasetSummaryResponse)
async def get_datasets_summary(
    mine_only: bool = Query(False),
    user: OptionalUser = None,
    db: DbSession = None,
):
    """Get overall metrics (total count, file count, total size) for accessible datasets."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    is_admin = "admin" in user.get("roles", []) if user else False
    stats = dataset_service.get_summary_stats(user_keycloak_id=user_keycloak_id, mine_only=mine_only, is_admin=is_admin)
    return stats



@router.get("/{slug}", response_model=DatasetResponse)
async def get_dataset(
    slug: str,
    user: OptionalUser = None,
    db: DbSession = None,
):
    """Get a dataset by slug. Private datasets require authentication."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    is_admin = "admin" in user.get("roles", []) if user else False
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user_keycloak_id, is_admin=is_admin)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return DatasetResponse.model_validate(dataset)


@router.patch("/{slug}", response_model=DatasetResponse)
async def update_dataset(
    slug: str,
    update: DatasetUpdate,
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Update dataset metadata. Only the owner can update."""
    dataset_service = DatasetService(db)
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    owner = db.query(User).filter(User.id == dataset.owner_id).first()
    if not owner or owner.keycloak_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the owner can update this dataset.")

    updated = dataset_service.update_dataset(dataset, update.model_dump(exclude_unset=True))
    return DatasetResponse.model_validate(updated)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    slug: str,
    user: CurrentUser = None,
    db: DbSession = None,
):
    """Delete a dataset. Only the owner or an admin can delete."""
    dataset_service = DatasetService(db)
    is_admin = "admin" in user.get("roles", []) if user else False
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user["sub"], is_admin=is_admin)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    if not is_admin:
        owner = db.query(User).filter(User.id == dataset.owner_id).first()
        if not owner or owner.keycloak_id != user["sub"]:
            raise HTTPException(status_code=403, detail="Only the owner can delete this dataset.")

    dataset_service.delete_dataset(dataset)


@router.get("/{slug}/preview", response_model=PreviewResponse)
async def get_preview(
    slug: str,
    file_path: Optional[str] = Query(None),
    version: Optional[str] = Query(None, description="Specific dataset version to preview"),
    user: OptionalUser = None,
    db: DbSession = None,
):
    """Get a data preview for a specific file or primary data file in a dataset."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user_keycloak_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if dataset.status != DatasetStatus.READY:
        raise HTTPException(status_code=409, detail="Dataset is not ready for preview yet.")

    # Find the requested or latest dataset version
    if version:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.version == version
        ).first()
    else:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.is_latest == True
        ).first()
        
    if not version_obj:
        raise HTTPException(status_code=404, detail="Dataset version not found.")

    if file_path:
        # Find specific file by logical path
        vf = db.query(DatasetVersionFile).filter(
            DatasetVersionFile.version_id == version_obj.id,
            DatasetVersionFile.logical_path == file_path.lstrip("/")
        ).first()
        if not vf:
            raise HTTPException(status_code=404, detail=f"File {file_path} not found in dataset.")
        full_key = vf.file_asset.storage_path
        logical_filename = vf.logical_path
    else:
        # Find primary data file from database manifest
        version_files = db.query(DatasetVersionFile).filter(
            DatasetVersionFile.version_id == version_obj.id
        ).all()
        data_extensions = {".csv", ".tsv", ".txt", ".json", ".jsonl", ".parquet", ".xlsx", ".xls"}
        data_files = [vf for vf in version_files if any(vf.logical_path.endswith(ext) for ext in data_extensions)]
        if not data_files:
            return PreviewResponse(type="unsupported", error="No previewable data files found in dataset.")
        full_key = data_files[0].file_asset.storage_path
        logical_filename = data_files[0].logical_path

    preview_service = PreviewService()
    try:
        result = preview_service.generate_preview(full_key, filename=logical_filename)
        return PreviewResponse(**result)
    except Exception as e:
        import structlog
        log = structlog.get_logger(__name__)
        log.error("preview_generation_error", error=str(e))
        return PreviewResponse(type="error", error=f"Preview failed: {str(e)}")


@router.get("/{slug}/files", response_model=FileListResponse)
async def list_dataset_files(
    slug: str,
    version: Optional[str] = Query(None, description="Specific dataset version to list"),
    user: OptionalUser = None,
    db: DbSession = None,
):
    """List all files belonging to a dataset."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user_keycloak_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    if version:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.version == version
        ).first()
    else:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.is_latest == True
        ).first()

    if not version_obj:
        return FileListResponse(files=[], total_files=0, total_size=0)

    version_files = db.query(DatasetVersionFile).filter(
        DatasetVersionFile.version_id == version_obj.id
    ).all()

    file_items = []
    total_size = 0
    for vf in version_files:
        asset = vf.file_asset
        file_items.append({
            "key": asset.storage_path,
            "filename": vf.logical_path,
            "size": asset.size_bytes,
            "last_modified": asset.created_at
        })
        total_size += asset.size_bytes
        
    return FileListResponse(files=file_items, total_files=len(file_items), total_size=total_size)


@router.get("/{slug}/download")
async def download_dataset(
    slug: str,
    background_tasks: BackgroundTasks,
    file_path: Optional[str] = Query(None, description="Specific file to download"),
    preview: bool = Query(False, description="Return raw file instead of zip for preview"),
    version: Optional[str] = Query(None, description="Specific dataset version to download"),
    user: OptionalUser = None,
    db: DbSession = None,
):
    """Download a specific file via presigned URL or download entire dataset as ZIP."""
    dataset_service = DatasetService(db)
    user_keycloak_id = user["sub"] if user else None
    dataset = dataset_service.get_by_slug(slug, user_keycloak_id=user_keycloak_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    storage = StorageService()

    # Increment download count
    if not preview:
        dataset_service.increment_download_count(dataset.id)

    if version:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.version == version
        ).first()
    else:
        version_obj = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.is_latest == True
        ).first()

    if not version_obj:
        raise HTTPException(status_code=404, detail="Dataset version not found.")

    if file_path:
        # Download single file
        vf = db.query(DatasetVersionFile).filter(
            DatasetVersionFile.version_id == version_obj.id,
            DatasetVersionFile.logical_path == file_path.lstrip("/")
        ).first()
        if not vf:
            raise HTTPException(status_code=404, detail=f"File {file_path} not found in dataset.")
        
        full_key = vf.file_asset.storage_path
        filename = os.path.basename(vf.logical_path)
        
        if preview:
            url = storage.get_presigned_url(full_key, expires_in=3600)
            if not url:
                raise HTTPException(status_code=500, detail="Could not generate download URL.")
            return RedirectResponse(url=url)
        else:
            # Single file bulk/zip download
            import zipfile
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
            os.close(tmp_fd)

            try:
                with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    file_bytes = storage.get_object_bytes(full_key)
                    if file_bytes is None:
                        raise HTTPException(status_code=404, detail="File not found in storage.")
                    zf.writestr(filename, file_bytes)

                background_tasks.add_task(os.remove, tmp_path)
                zip_filename = os.path.splitext(filename)[0]
                return FileResponse(
                    tmp_path, 
                    media_type="application/zip", 
                    filename=f"{zip_filename}.zip"
                )
            except HTTPException:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise
            except Exception as e:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                raise HTTPException(status_code=500, detail=f"Error generating zip: {str(e)}")
    
    # Bulk Download
    version_files = db.query(DatasetVersionFile).filter(
        DatasetVersionFile.version_id == version_obj.id
    ).all()
    if not version_files:
        raise HTTPException(status_code=404, detail="No files found in dataset.")

    import zipfile
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)

    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for vf in version_files:
                filename = vf.logical_path
                file_bytes = storage.get_object_bytes(vf.file_asset.storage_path)
                if file_bytes:
                    zf.writestr(filename, file_bytes)

        background_tasks.add_task(os.remove, tmp_path)
        return FileResponse(
            tmp_path, 
            media_type="application/zip", 
            filename=f"{dataset.slug}.zip"
        )
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Error generating zip: {str(e)}")
