import abc
import io
import logging
import uuid
from pathlib import Path
from typing import Optional, Tuple
from fastapi import HTTPException, status
from botocore.config import Config
import boto3

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class BaseStorageService(abc.ABC):
    """Abstract base storage service defining the storage contract."""

    @abc.abstractmethod
    async def save_file(self, content: bytes, original_filename: str, subfolder: str = "") -> str:
        """Saves file bytes and returns the canonical URL/path for the file."""
        pass

    @abc.abstractmethod
    async def delete_file(self, file_url_or_key: str) -> bool:
        """Deletes file corresponding to the given URL or storage key."""
        pass

    @abc.abstractmethod
    async def get_presigned_url(self, object_key: str, expires_in: int = 3600) -> str:
        """Generates a short-lived URL for retrieving the file."""
        pass

    @abc.abstractmethod
    async def get_file_bytes(self, object_key: str) -> Optional[bytes]:
        """Retrieves raw file bytes."""
        pass

    def validate_file(self, content: bytes, filename: str, content_type: Optional[str] = None):
        """Validates payload size, file extension, and MIME type."""
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE") else 413,
                detail=f"File exceeds maximum upload size of {max_mb}MB",
            )
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )
        if content_type and content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported MIME type '{content_type}'.",
            )


class LocalStorageService(BaseStorageService):
    """Local filesystem storage adapter used for zero-budget local development."""

    def __init__(self, root_dir: Optional[Path] = None):
        self.root_dir = root_dir or settings.absolute_storage_path
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _extract_relative_path(self, file_url_or_key: str) -> str:
        """Normalizes file URL or key into relative local path."""
        cleaned = file_url_or_key.strip()
        for prefix in ("/api/v1/storage/", "/storage/"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):]
                break
        return cleaned.lstrip("/")

    async def save_file(self, content: bytes, original_filename: str, subfolder: str = "") -> str:
        self.validate_file(content, original_filename)
        ext = Path(original_filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"

        dest_dir = self.root_dir / subfolder if subfolder else self.root_dir
        dest_dir.mkdir(parents=True, exist_ok=True)

        target_path = dest_dir / unique_name
        target_path.write_bytes(content)

        # Return canonical storage route
        key = f"{subfolder}/{unique_name}" if subfolder else unique_name
        return f"/api/v1/storage/{key}"

    async def delete_file(self, file_url_or_key: str) -> bool:
        if not file_url_or_key:
            return False
        rel_path = self._extract_relative_path(file_url_or_key)
        target = self.root_dir / rel_path
        try:
            resolved = target.resolve()
            # Ensure path is within root_dir to prevent path traversal
            if self.root_dir.resolve() in resolved.parents or resolved == self.root_dir.resolve():
                if resolved.exists() and resolved.is_file():
                    resolved.unlink()
                    return True
        except Exception as e:
            logger.warning("Failed to delete local file %s: %s", file_url_or_key, e)
        return False

    async def get_presigned_url(self, object_key: str, expires_in: int = 3600) -> str:
        # In local storage, the canonical route serves the file directly
        rel_path = self._extract_relative_path(object_key)
        return f"/api/v1/storage/{rel_path}"

    async def get_file_bytes(self, object_key: str) -> Optional[bytes]:
        rel_path = self._extract_relative_path(object_key)
        target = self.root_dir / rel_path
        try:
            resolved = target.resolve()
            if self.root_dir.resolve() in resolved.parents and resolved.is_file():
                return resolved.read_bytes()
        except Exception:
            pass
        return None


class R2StorageService(BaseStorageService):
    """
    Cloudflare R2 Object Storage adapter using S3-compatible API.
    Designed for private buckets with short-lived presigned URLs and zero egress fees.
    """

    def __init__(
        self,
        bucket_name: Optional[str] = None,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        s3_client: Optional[object] = None,
    ):
        self.bucket_name = bucket_name or settings.R2_BUCKET_NAME
        self.endpoint_url = endpoint_url or settings.resolved_r2_endpoint_url
        self.access_key_id = access_key_id or settings.R2_ACCESS_KEY_ID
        self.secret_access_key = secret_access_key or settings.R2_SECRET_ACCESS_KEY

        # Allow injected client for unit testing with mocked S3 responses
        if s3_client is not None:
            self.s3_client = s3_client
        else:
            session = boto3.session.Session()
            self.s3_client = session.client(
                service_name="s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                region_name="auto",
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )

    def _extract_object_key(self, file_url_or_key: str) -> str:
        """Extracts the storage object key from a full URL or canonical path."""
        cleaned = file_url_or_key.strip()
        for prefix in ("/api/v1/storage/", "/storage/"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):]
                break
        return cleaned.lstrip("/")

    def _infer_content_type(self, ext: str) -> str:
        ext = ext.lower()
        if ext in (".jpg", ".jpeg"):
            return "image/jpeg"
        if ext == ".png":
            return "image/png"
        if ext == ".webp":
            return "image/webp"
        return "application/octet-stream"

    async def save_file(self, content: bytes, original_filename: str, subfolder: str = "") -> str:
        self.validate_file(content, original_filename)
        ext = Path(original_filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        object_key = f"{subfolder}/{unique_name}" if subfolder else unique_name
        content_type = self._infer_content_type(ext)

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=content,
                ContentType=content_type,
            )
            # Return canonical backend path which will generate short-lived signed access
            return f"/api/v1/storage/{object_key}"
        except Exception as e:
            logger.error("Cloudflare R2 upload error for key %s: %s", object_key, e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to store asset in Cloudflare R2 storage.",
            )

    async def delete_file(self, file_url_or_key: str) -> bool:
        if not file_url_or_key:
            return False
        object_key = self._extract_object_key(file_url_or_key)
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            return True
        except Exception as e:
            logger.warning("Failed to delete object %s from R2: %s", object_key, e)
            return False

    async def get_presigned_url(self, object_key: str, expires_in: int = 3600) -> str:
        cleaned_key = self._extract_object_key(object_key)
        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket_name, "Key": cleaned_key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as e:
            logger.error("Failed to generate presigned URL for %s: %s", cleaned_key, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate secure asset access URL.",
            )

    async def get_file_bytes(self, object_key: str) -> Optional[bytes]:
        cleaned_key = self._extract_object_key(object_key)
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=cleaned_key)
            return response["Body"].read()
        except Exception as e:
            logger.error("Failed to fetch object %s from R2: %s", cleaned_key, e)
            return None


def get_storage_service() -> BaseStorageService:
    """Factory creating the appropriate storage adapter based on environment configuration."""
    if settings.STORAGE_PROVIDER == "r2":
        return R2StorageService()
    return LocalStorageService()


storage_service = get_storage_service()
