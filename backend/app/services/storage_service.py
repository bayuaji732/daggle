"""
RustFS / S3-compatible storage client.

Reads config from Settings (not raw os.getenv).
Upload paths:
  uploads-staging/<keycloak_sub>/<slug>/<filename>   ← landing zone
  datasets/<slug>/v<N>/<filename>                     ← processed versions
"""

import boto3
import structlog
from botocore.exceptions import ClientError
from botocore.client import Config
from typing import List, Optional

from app.core.config import settings

log = structlog.get_logger(__name__)


class StorageService:
    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.RUSTFS_ENDPOINT,
            aws_access_key_id=settings.RUSTFS_ACCESS_KEY,
            aws_secret_access_key=settings.RUSTFS_SECRET_KEY,
            region_name="us-east-1",
            config=Config(signature_version="s3v4")
        )
        # Create a separate client configured with the public endpoint for generating presigned URLs
        # This ensures the signature is calculated using the Host header the browser will send.
        public_endpoint = "http://localhost:9000"
        self.s3_public = boto3.client(
            "s3",
            endpoint_url=public_endpoint,
            aws_access_key_id=settings.RUSTFS_ACCESS_KEY,
            aws_secret_access_key=settings.RUSTFS_SECRET_KEY,
            region_name="us-east-1",
            config=Config(signature_version="s3v4")
        )
        self.bucket_datasets = settings.RUSTFS_BUCKET_DATASETS
        self.bucket_staging = settings.RUSTFS_BUCKET_STAGING
        self.bucket_exports = settings.RUSTFS_BUCKET_EXPORTS

    # ── Upload ────────────────────────────────────────────────

    def upload_to_staging(self, local_path: str, staging_key: str) -> bool:
        """Upload a raw user file to the staging bucket."""
        try:
            self.s3.upload_file(local_path, self.bucket_staging, staging_key)
            log.info("staging_upload_ok", key=staging_key)
            return True
        except Exception as exc:
            log.error("staging_upload_failed", key=staging_key, error=str(exc))
            return False

    def move_to_datasets(self, staging_key: str, dataset_key: str) -> bool:
        """
        Copy from staging → datasets bucket, then delete from staging.
        Called by the ingestion worker after validation.
        """
        try:
            self.s3.copy_object(
                CopySource={"Bucket": self.bucket_staging, "Key": staging_key},
                Bucket=self.bucket_datasets,
                Key=dataset_key,
            )
            self.s3.delete_object(Bucket=self.bucket_staging, Key=staging_key)
            log.info("move_to_datasets_ok", staging_key=staging_key, dataset_key=dataset_key)
            return True
        except Exception as exc:
            log.error("move_to_datasets_failed", error=str(exc))
            return False

    def upload_file(self, local_path: str, key: str, bucket: Optional[str] = None) -> bool:
        """Generic upload to datasets bucket (or specified bucket)."""
        target_bucket = bucket or self.bucket_datasets
        try:
            self.s3.upload_file(local_path, target_bucket, key)
            return True
        except Exception as exc:
            log.error("upload_failed", bucket=target_bucket, key=key, error=str(exc))
            return False

    # ── Download ──────────────────────────────────────────────

    def download_file(self, key: str, local_path: str, bucket: Optional[str] = None) -> bool:
        """Download a file from datasets bucket to a local path."""
        target_bucket = bucket or self.bucket_datasets
        try:
            self.s3.download_file(target_bucket, key, local_path)
            return True
        except Exception as exc:
            log.error("download_failed", key=key, error=str(exc))
            return False

    def get_object_bytes(self, key: str, bucket: Optional[str] = None) -> Optional[bytes]:
        """Stream object content into memory (for previews)."""
        target_bucket = bucket or self.bucket_datasets
        try:
            resp = self.s3.get_object(Bucket=target_bucket, Key=key)
            return resp["Body"].read()
        except Exception as exc:
            log.error("get_object_failed", key=key, error=str(exc))
            return None

    # ── Delete ────────────────────────────────────────────────

    def delete_file(self, key: str, bucket: Optional[str] = None) -> bool:
        target_bucket = bucket or self.bucket_datasets
        try:
            self.s3.delete_object(Bucket=target_bucket, Key=key)
            return True
        except Exception as exc:
            log.error("delete_failed", key=key, error=str(exc))
            return False

    def delete_prefix(self, prefix: str, bucket: Optional[str] = None) -> int:
        """Delete all objects under a prefix. Returns count deleted."""
        target_bucket = bucket or self.bucket_datasets
        try:
            paginator = self.s3.get_paginator("list_objects_v2")
            deleted = 0
            for page in paginator.paginate(Bucket=target_bucket, Prefix=prefix):
                objects = [{"Key": o["Key"]} for o in page.get("Contents", [])]
                if objects:
                    self.s3.delete_objects(
                        Bucket=target_bucket, Delete={"Objects": objects}
                    )
                    deleted += len(objects)
            return deleted
        except Exception as exc:
            log.error("delete_prefix_failed", prefix=prefix, error=str(exc))
            return 0

    # ── List ──────────────────────────────────────────────────

    def list_files(self, prefix: str = "", bucket: Optional[str] = None) -> List[dict]:
        target_bucket = bucket or self.bucket_datasets
        try:
            paginator = self.s3.get_paginator("list_objects_v2")
            results = []
            for page in paginator.paginate(Bucket=target_bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    results.append({
                        "key": obj["Key"],
                        "size": obj.get("Size", 0),
                        "last_modified": obj.get("LastModified"),
                    })
            return results
        except Exception as exc:
            log.error("list_failed", prefix=prefix, error=str(exc))
            return []

    # ── Presigned URLs ────────────────────────────────────────

    def get_presigned_url(self, key: str, expires_in: int = 3600, bucket: Optional[str] = None) -> str:
        target_bucket = bucket or self.bucket_datasets
        try:
            url = self.s3_public.generate_presigned_url(
                "get_object",
                Params={"Bucket": target_bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as exc:
            log.error("presign_failed", key=key, error=str(exc))
            return ""
