"""
PreviewService — generates in-memory data previews from RustFS files.

Reads files via StorageService (no separate boto3 client here).
"""

import io
import json
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from PIL import Image

from app.services.storage_service import StorageService


class PreviewService:
    def __init__(self):
        self.storage = StorageService()

    def generate_preview(self, storage_path: str, filename: Optional[str] = None, max_rows: int = 100) -> Dict[str, Any]:
        """
        Dispatch preview generation based on file extension.
        `storage_path` is the RustFS key in the datasets bucket.
        """
        suffix = Path(filename or storage_path).suffix.lower()
        content = self.storage.get_object_bytes(storage_path)

        if content is None:
            return {"type": "error", "error": "File not found in storage."}

        if suffix == ".csv":
            return self._preview_csv(content, max_rows)
        elif suffix == ".tsv":
            return self._preview_tsv(content, max_rows)
        elif suffix in (".json", ".jsonl"):
            return self._preview_json(content, max_rows)
        elif suffix in (".xlsx", ".xls"):
            return self._preview_excel(content, max_rows)
        elif suffix == ".parquet":
            return self._preview_parquet(content, max_rows)
        elif suffix == ".txt":
            return self._preview_txt(content, max_rows)
        else:
            return {"type": "unsupported", "error": f"No preview available for '{suffix}' files."}

    # ── Tabular formats ───────────────────────────────────────

    def _preview_csv(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            df = pd.read_csv(io.BytesIO(content))
            return self._df_to_preview(df, max_rows, file_type="csv", file_size=len(content))
        except Exception as exc:
            return {"type": "csv", "error": f"Failed to parse CSV: {exc}"}

    def _preview_tsv(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            df = pd.read_csv(io.BytesIO(content), sep='\t')
            return self._df_to_preview(df, max_rows, file_type="tsv", file_size=len(content))
        except Exception as exc:
            return {"type": "tsv", "error": f"Failed to parse TSV: {exc}"}

    def _preview_txt(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            text = content.decode("utf-8")
            lines = text.splitlines()
            preview_lines = lines[:max_rows]
            truncated_text = "\n".join(preview_lines)
            
            return {
                "type": "txt",
                "content": truncated_text,
                "total_rows": len(lines),
                "preview_rows": len(preview_lines),
                "file_size": len(content),
            }
        except Exception as exc:
            return {"type": "txt", "error": f"Failed to parse TXT: {exc}"}

    def _preview_excel(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            df = pd.read_excel(io.BytesIO(content))
            return self._df_to_preview(df, max_rows, file_type="excel", file_size=len(content))
        except Exception as exc:
            return {"type": "excel", "error": f"Failed to parse Excel: {exc}"}

    def _preview_parquet(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            df = pd.read_parquet(io.BytesIO(content))
            return self._df_to_preview(df, max_rows, file_type="parquet", file_size=len(content))
        except Exception as exc:
            return {"type": "parquet", "error": f"Failed to parse Parquet: {exc}"}

    def _preview_json(self, content: bytes, max_rows: int) -> Dict[str, Any]:
        try:
            text = content.decode("utf-8").strip()
            
            # First try parsing as a single standard JSON document
            try:
                data = json.loads(text)
                is_jsonl = False
            except json.JSONDecodeError:
                # If that fails, try parsing as JSONL (one JSON object per line)
                data = []
                for line in text.splitlines():
                    line = line.strip()
                    if line:
                        data.append(json.loads(line))
                is_jsonl = True

            # Limit the items shown in the preview
            if isinstance(data, list):
                preview_data = data[:max_rows]
                total_rows = len(data)
                preview_rows = len(preview_data)
            else:
                preview_data = data
                total_rows = 1
                preview_rows = 1

            # Format beautifully with indentation
            pretty_json = json.dumps(preview_data, indent=2)

            return {
                "type": "jsonl" if is_jsonl else "json",
                "content": pretty_json,
                "total_rows": total_rows,
                "preview_rows": preview_rows,
                "file_size": len(content),
            }
        except Exception as exc:
            return {"type": "json", "error": f"Failed to parse JSON: {exc}"}

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _df_to_preview(df: pd.DataFrame, max_rows: int, file_type: str, file_size: int) -> Dict[str, Any]:
        df.columns = df.columns.astype(str)
        preview = df.head(max_rows)
        return {
            "type": file_type,
            "columns": list(preview.columns),
            "rows": preview.to_dict("records"),
            "total_rows": len(df),
            "preview_rows": len(preview),
            "file_size": file_size,
        }
