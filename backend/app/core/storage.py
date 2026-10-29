import abc
import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, status
from app.core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class BaseStorageService(abc.ABC):
    @abc.abstractmethod
    async def save_file(self, content: bytes, original_filename: str, subfolder: str = "") -> str:
        """Saves file bytes and returns the accessible URL/path."""
        pass

    @abc.abstractmethod
    async def delete_file(self, file_url: str) -> bool:
        """Deletes file corresponding to the given URL."""
        pass


class LocalStorageService(BaseStorageService):
    def __init__(self, root_dir: Optional[Path] = None):
        self.root_dir = root_dir or settings.absolute_storage_path
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, content: bytes, filename: str, content_type: Optional[str] = None):
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB",
            )
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )
        if content_type and content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported MIME type '{content_type}'.",
            )

    async def save_file(self, content: bytes, original_filename: str, subfolder: str = "") -> str:
        self.validate_file(content, original_filename)
        ext = Path(original_filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"

        dest_dir = self.root_dir / subfolder if subfolder else self.root_dir
        dest_dir.mkdir(parents=True, exist_ok=True)

        target_path = dest_dir / unique_name
        # Write bytes
        target_path.write_bytes(content)

        # Return the public serving URL path (e.g. /storage/garments/abcd.png)
        if subfolder:
            return f"/storage/{subfolder}/{unique_name}"
        return f"/storage/{unique_name}"

    async def delete_file(self, file_url: str) -> bool:
        if not file_url or not file_url.startswith("/storage/"):
            return False
        rel_path = file_url[len("/storage/"):]
        target = self.root_dir / rel_path
        try:
            # Ensure path is within root_dir to prevent path traversal
            resolved = target.resolve()
            if self.root_dir.resolve() in resolved.parents or resolved == self.root_dir.resolve():
                if resolved.exists():
                    resolved.unlink()
                    return True
        except Exception:
            pass
        return False


storage_service = LocalStorageService()
