import os
import shutil
import tempfile
from app.core.database import SessionLocal
from app.models import Dataset, DatasetVersion, DatasetVersionFile, FileAsset
from app.services.storage_service import StorageService

def backfill():
    db = SessionLocal()
    storage = StorageService()
    
    versions = db.query(DatasetVersion).all()
    for version in versions:
        dataset = db.query(Dataset).filter(Dataset.id == version.dataset_id).first()
        if not dataset:
            continue
            
        target_dir = f"/extracted_datasets/{dataset.slug}/{version.version}"
        # Check if directory has actual files (not just an empty dir from a failed run)
        has_files = os.path.exists(target_dir) and any(
            files for _, _, files in os.walk(target_dir)
        )
        if has_files:
            print(f"Skipping {dataset.slug}/{version.version}, already exists")
            continue
            
        print(f"Extracting {dataset.slug}/{version.version}...")
        os.makedirs(target_dir, exist_ok=True)
        
        files = db.query(DatasetVersionFile).filter(DatasetVersionFile.version_id == version.id).all()
        for f in files:
            asset = db.query(FileAsset).filter(FileAsset.id == f.file_asset_id).first()
            if not asset:
                continue
                
            dest_path = os.path.join(target_dir, f.logical_path)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp_path = tmp.name
                
            if storage.download_file(asset.storage_path, tmp_path):
                shutil.move(tmp_path, dest_path)
            else:
                print(f"Failed to download {asset.storage_path}")
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
    print("Backfill complete.")

if __name__ == "__main__":
    backfill()
