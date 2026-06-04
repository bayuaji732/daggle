"""
Pydantic request/response schemas for the API layer.

UserCreate / UserLogin / Token removed — auth is handled entirely
by Keycloak OIDC. The 'user' in API responses is the Keycloak sub dict.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.models import DatasetVisibility, DatasetStatus


# ── Dataset ───────────────────────────────────────────────────

class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=2000)
    visibility: DatasetVisibility = DatasetVisibility.PUBLIC
    tags: Optional[List[str]] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    visibility: Optional[DatasetVisibility] = None
    tags: Optional[List[str]] = None


class DatasetVersionResponse(BaseModel):
    id: int
    dataset_id: int
    version: str
    description: Optional[str] = None
    changelog: Optional[str] = None
    size_bytes: int = 0
    file_count: int = 0
    is_latest: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: int
    keycloak_id: str
    username: str
    email: str
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


class DatasetResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    file_types: Optional[List[str]] = None
    visibility: DatasetVisibility
    status: DatasetStatus
    owner_keycloak_id: str        # Keycloak sub — no local user FK exposed
    owner: Optional[UserResponse] = None
    total_size_bytes: int = 0
    file_count: int = 0
    download_count: int = 0
    created_at: datetime
    updated_at: datetime
    versions: List[DatasetVersionResponse] = []

    model_config = {"from_attributes": True}

    @field_validator("tags", "file_types", mode="before")
    @classmethod
    def parse_comma_separated(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v

    @classmethod
    def from_orm_with_owner(cls, dataset, owner_keycloak_id: str) -> "DatasetResponse":
        data = cls.model_validate(dataset)
        data.owner_keycloak_id = owner_keycloak_id
        return data


class DatasetListResponse(BaseModel):
    items: List[DatasetResponse]
    total: int
    page: int = 1
    page_size: int = 20


# ── Preview ───────────────────────────────────────────────────

class PreviewResponse(BaseModel):
    type: str
    columns: Optional[List[str]] = None
    rows: Optional[List[dict]] = None
    content: Optional[str] = None
    total_rows: Optional[int] = None
    preview_rows: Optional[int] = None
    file_size: Optional[int] = None
    error: Optional[str] = None


# ── Generic ───────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None


class DatasetSummaryResponse(BaseModel):
    total: int
    total_public: int
    total_private: int
    total_files: int
    total_size_bytes: int


# ── File Browser ──────────────────────────────────────────────

class FileItem(BaseModel):
    key: str
    filename: str
    size: int
    last_modified: Optional[datetime] = None


class FileListResponse(BaseModel):
    files: List[FileItem]
    total_files: int
    total_size: int

