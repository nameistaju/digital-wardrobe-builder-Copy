import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse

from app.core.config import settings
from app.core.storage import storage_service, R2StorageService

router = APIRouter()


@router.get("/{file_path:path}", summary="Securely serve or redirect to stored image")
async def get_storage_file(file_path: str):
    """
    Secure retrieval endpoint for images.
    - In Cloudflare R2 mode: Returns HTTP 307 temporary redirect to a short-lived presigned URL.
    - In Local mode: Serves the file from the local storage directory with path traversal protection.
    """
    # Guard against path traversal
    normalized = Path(file_path).as_posix().lstrip("/")
    if ".." in normalized or normalized.startswith(("/", "\\")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path traversal sequence.")

    # 1. Cloudflare R2 Provider: Generate presigned URL and redirect
    if isinstance(storage_service, R2StorageService) or settings.STORAGE_PROVIDER == "r2":
        presigned_url = await storage_service.get_presigned_url(normalized, expires_in=3600)
        return RedirectResponse(
            url=presigned_url,
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Cache-Control": "public, max-age=3600"},
        )

    # 2. Local Filesystem Provider
    local_target = (settings.absolute_storage_path / normalized).resolve()
    root_resolved = settings.absolute_storage_path.resolve()

    if root_resolved not in local_target.parents and local_target != root_resolved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if not local_target.exists() or not local_target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found.")

    media_type, _ = mimetypes.guess_type(local_target.name)
    return FileResponse(
        path=local_target,
        media_type=media_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )
