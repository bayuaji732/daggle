from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, BigInteger
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime
import enum


class Base(DeclarativeBase):
    pass


class DatasetVisibility(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class DatasetStatus(str, enum.Enum):
    PENDING = "pending"       # upload received, not yet processed
    PROCESSING = "processing" # worker is extracting/validating
    READY = "ready"           # available for use
    FAILED = "failed"         # processing error


class User(Base):
    """
    Synced from Keycloak — we store a local shadow record for FK relations.
    `keycloak_id` is the authoritative identity (Keycloak's `sub` claim).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    keycloak_id = Column(String(36), unique=True, nullable=False, index=True)  # Keycloak UUID (sub)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    datasets = relationship("Dataset", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', keycloak_id='{self.keycloak_id}')>"


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)  # URL-friendly name
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)                                    # comma-separated for MVP
    file_types = Column(Text, nullable=True)                              # comma-separated file types
    visibility = Column(Enum(DatasetVisibility), default=DatasetVisibility.PUBLIC, nullable=False)
    status = Column(Enum(DatasetStatus), default=DatasetStatus.PENDING, nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    storage_path = Column(String(500), nullable=True)                     # RustFS key prefix
    total_size_bytes = Column(BigInteger, default=0, nullable=False)
    file_count = Column(Integer, default=0, nullable=False)
    download_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="datasets")
    versions = relationship("DatasetVersion", back_populates="dataset", cascade="all, delete-orphan")

    @property
    def owner_keycloak_id(self) -> str:
        return self.owner.keycloak_id if self.owner else ""

    def __repr__(self):
        return f"<Dataset(id={self.id}, slug='{self.slug}', status='{self.status}')>"


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    version = Column(String(50), nullable=False)                          # e.g. "v1", "v2"
    description = Column(Text, nullable=True)
    changelog = Column(Text, nullable=True)
    storage_path = Column(String(500), nullable=True)                     # RustFS key for this version
    size_bytes = Column(BigInteger, default=0, nullable=False)
    file_count = Column(Integer, default=0, nullable=False)
    is_latest = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dataset = relationship("Dataset", back_populates="versions")
    files = relationship("DatasetVersionFile", back_populates="version", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DatasetVersion(id={self.id}, version='{self.version}', dataset_id={self.dataset_id})>"


class FileAsset(Base):
    __tablename__ = "file_assets"

    id = Column(Integer, primary_key=True, index=True)
    sha256 = Column(String(64), unique=True, nullable=False, index=True)
    size_bytes = Column(BigInteger, nullable=False)
    storage_path = Column(String(500), nullable=False)                     # e.g. "files/sha256"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<FileAsset(id={self.id}, sha256='{self.sha256}', size_bytes={self.size_bytes})>"


class DatasetVersionFile(Base):
    __tablename__ = "dataset_version_files"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False, index=True)
    file_asset_id = Column(Integer, ForeignKey("file_assets.id"), nullable=False, index=True)
    logical_path = Column(String(500), nullable=False)                     # e.g. "data/train.csv"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    version = relationship("DatasetVersion", back_populates="files")
    file_asset = relationship("FileAsset")

    def __repr__(self):
        return f"<DatasetVersionFile(id={self.id}, version_id={self.version_id}, logical_path='{self.logical_path}')>"

