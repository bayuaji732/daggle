from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models import Dataset, DatasetVersion, DatasetVisibility, DatasetStatus, User


class DatasetService:
    def __init__(self, db: Session):
        self.db = db

    # ── Create ────────────────────────────────────────────────

    def create_dataset(
        self,
        *,
        name: str,
        slug: str,
        description: Optional[str],
        visibility: DatasetVisibility,
        owner_id: int,
        tags: Optional[str],
        storage_path: str,
        total_size_bytes: int,
    ) -> Dataset:
        dataset = Dataset(
            name=name,
            slug=slug,
            description=description,
            visibility=visibility,
            status=DatasetStatus.PENDING,
            owner_id=owner_id,
            tags=tags,
            storage_path=storage_path,
            total_size_bytes=total_size_bytes,
        )
        self.db.add(dataset)
        self.db.commit()
        self.db.refresh(dataset)
        return dataset

    # ── Read ──────────────────────────────────────────────────

    def get_by_slug(
        self, slug: str, *, user_keycloak_id: Optional[str] = None, is_admin: bool = False
    ) -> Optional[Dataset]:
        """
        Fetch by slug. Private datasets are only returned if the requesting
        user (keycloak_id) is the owner, or if the user is an admin.
        """
        query = self.db.query(Dataset).filter(Dataset.slug == slug)

        if is_admin:
            pass # Admins can fetch any dataset
        elif user_keycloak_id:
            owner_sub = (
                self.db.query(User.id)
                .filter(User.keycloak_id == user_keycloak_id)
                .scalar_subquery()
            )
            query = query.filter(
                or_(
                    Dataset.visibility == DatasetVisibility.PUBLIC,
                    Dataset.owner_id == owner_sub,
                )
            )
        else:
            query = query.filter(Dataset.visibility == DatasetVisibility.PUBLIC)

        return query.first()

    def list_datasets(
        self,
        *,
        search: Optional[str] = None,
        visibility_filter: Optional[DatasetVisibility] = None,
        user_keycloak_id: Optional[str] = None,
        mine_only: bool = False,
        is_admin: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Dataset], int]:
        """Return (items, total) for paginated dataset listing."""
        query = self.db.query(Dataset)

        # Visibility: admin → all; anonymous → public only; authenticated → own + public
        if is_admin and not mine_only:
            pass # Admins see all datasets globally
        elif user_keycloak_id:
            owner_sub = (
                self.db.query(User.id)
                .filter(User.keycloak_id == user_keycloak_id)
                .scalar_subquery()
            )
            if mine_only:
                query = query.filter(Dataset.owner_id == owner_sub)
            else:
                query = query.filter(
                    or_(
                        Dataset.visibility == DatasetVisibility.PUBLIC,
                        Dataset.owner_id == owner_sub,
                    )
                )
        else:
            query = query.filter(Dataset.visibility == DatasetVisibility.PUBLIC)

        if visibility_filter:
            query = query.filter(Dataset.visibility == visibility_filter)

        if search:
            query = query.filter(
                or_(
                    Dataset.name.ilike(f"%{search}%"),
                    Dataset.description.ilike(f"%{search}%"),
                    Dataset.tags.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        items = (
            query.order_by(Dataset.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_summary_stats(self, *, user_keycloak_id: Optional[str] = None, mine_only: bool = False, is_admin: bool = False) -> dict:
        """Return aggregated stats (total datasets, file count, storage bytes) for accessible datasets."""
        from sqlalchemy import func, case
        
        query = self.db.query(
            func.count(Dataset.id).label("total_datasets"),
            func.sum(case((Dataset.visibility == DatasetVisibility.PUBLIC, 1), else_=0)).label("total_public"),
            func.sum(case((Dataset.visibility == DatasetVisibility.PRIVATE, 1), else_=0)).label("total_private"),
            func.sum(Dataset.file_count).label("total_files"),
            func.sum(Dataset.total_size_bytes).label("total_size_bytes")
        )
        
        if is_admin and not mine_only:
            pass # Admins count everything globally
        elif user_keycloak_id:
            owner_sub = (
                self.db.query(User.id)
                .filter(User.keycloak_id == user_keycloak_id)
                .scalar_subquery()
            )
            if mine_only:
                query = query.filter(Dataset.owner_id == owner_sub)
            else:
                query = query.filter(
                    or_(
                        Dataset.visibility == DatasetVisibility.PUBLIC,
                        Dataset.owner_id == owner_sub,
                    )
                )
        else:
            query = query.filter(Dataset.visibility == DatasetVisibility.PUBLIC)
            
        stats = query.first()
        
        return {
            "total": stats.total_datasets or 0,
            "total_public": int(stats.total_public) if stats.total_public is not None else 0,
            "total_private": int(stats.total_private) if stats.total_private is not None else 0,
            "total_files": int(stats.total_files) if stats.total_files is not None else 0,
            "total_size_bytes": int(stats.total_size_bytes) if stats.total_size_bytes is not None else 0
        }

    # ── Update ────────────────────────────────────────────────

    def update_dataset(self, dataset: Dataset, fields: dict) -> Dataset:
        for key, value in fields.items():
            if key == "tags" and isinstance(value, list):
                value = ",".join(value)
            if hasattr(dataset, key):
                setattr(dataset, key, value)
        self.db.commit()
        self.db.refresh(dataset)
        return dataset

    def set_status(self, dataset_id: int, status: DatasetStatus) -> None:
        self.db.query(Dataset).filter(Dataset.id == dataset_id).update(
            {"status": status}
        )
        self.db.commit()

    # ── Delete ────────────────────────────────────────────────

    def delete_dataset(self, dataset: Dataset) -> None:
        self.db.delete(dataset)
        self.db.commit()

    # ── Download count ────────────────────────────────────────

    def increment_download_count(self, dataset_id: int) -> None:
        self.db.query(Dataset).filter(Dataset.id == dataset_id).update(
            {Dataset.download_count: Dataset.download_count + 1}
        )
        self.db.commit()
