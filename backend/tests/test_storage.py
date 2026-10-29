import asyncio
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.storage import LocalStorageService, R2StorageService
from app.api.v1.storage import get_storage_file

client = TestClient(app)


def test_local_storage_validation():
    """Test file validation: size limit and file extension restrictions."""
    storage = LocalStorageService()

    # Valid PNG
    dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
    storage.validate_file(dummy_png, "shirt.png")

    # Invalid extension
    with pytest.raises(HTTPException) as exc_info:
        storage.validate_file(dummy_png, "script.exe")
    assert exc_info.value.status_code == 400
    assert "Unsupported file extension" in exc_info.value.detail

    # Oversized payload
    large_payload = b"0" * (settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    with pytest.raises(HTTPException) as exc_size:
        storage.validate_file(large_payload, "huge.png")
    assert exc_size.value.status_code == 413


def test_local_storage_crud_and_traversal_prevention():
    """Test saving, retrieving bytes, path traversal rejection, and deletion in LocalStorageService."""
    async def _run():
        storage = LocalStorageService()
        test_content = b"test-image-content-bytes-12345"
        filename = "test_item.jpg"

        # Save
        stored_path = await storage.save_file(test_content, filename, subfolder="tests")
        assert stored_path.startswith("/api/v1/storage/tests/")

        # Extract key
        rel_key = storage._extract_relative_path(stored_path)
        assert "tests/" in rel_key

        # Retrieve bytes
        retrieved = await storage.get_file_bytes(rel_key)
        assert retrieved == test_content

        # Path traversal attack on delete should be safely rejected
        traversal_delete = await storage.delete_file("../../../secret_file.txt")
        assert traversal_delete is False

        # Legitimate deletion
        deleted = await storage.delete_file(stored_path)
        assert deleted is True

        # After deletion, bytes should be None
        assert await storage.get_file_bytes(rel_key) is None

    asyncio.run(_run())


def test_r2_storage_adapter_mocked():
    """Test Cloudflare R2 storage adapter operations using mocked S3 responses."""
    async def _run():
        mock_s3 = MagicMock()
        mock_s3.put_object.return_value = {"ETag": '"mock-etag-123"'}
        mock_s3.generate_presigned_url.return_value = (
            "https://digital-wardrobe-assets.r2.cloudflarestorage.com/garments/test.png?X-Amz-Signature=mock"
        )
        mock_s3.delete_object.return_value = {}

        # Mock get_object stream
        mock_body = MagicMock()
        mock_body.read.return_value = b"mock-r2-image-bytes"
        mock_s3.get_object.return_value = {"Body": mock_body}

        r2_storage = R2StorageService(
            bucket_name="digital-wardrobe-assets",
            account_id="mock_acc_123",
            access_key_id="mock_key",
            secret_access_key="mock_secret",
            endpoint_url="https://mock_acc_123.r2.cloudflarestorage.com",
            s3_client=mock_s3,
        )

        # 1. Save file to R2
        dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        url = await r2_storage.save_file(dummy_png, "blazer.png", subfolder="garments")
        assert url.startswith("/api/v1/storage/garments/")
        mock_s3.put_object.assert_called_once()
        call_args = mock_s3.put_object.call_args[1]
        assert call_args["Bucket"] == "digital-wardrobe-assets"
        assert call_args["ContentType"] == "image/png"
        assert call_args["Body"] == dummy_png

        # 2. Generate presigned URL
        presigned = await r2_storage.get_presigned_url(url, expires_in=1800)
        assert "https://digital-wardrobe-assets.r2.cloudflarestorage.com" in presigned
        mock_s3.generate_presigned_url.assert_called_once_with(
            ClientMethod="get_object",
            Params={"Bucket": "digital-wardrobe-assets", "Key": call_args["Key"]},
            ExpiresIn=1800,
        )

        # 3. Fetch bytes from R2
        fetched_bytes = await r2_storage.get_file_bytes(url)
        assert fetched_bytes == b"mock-r2-image-bytes"

        # 4. Delete object from R2
        del_res = await r2_storage.delete_file(url)
        assert del_res is True
        mock_s3.delete_object.assert_called_once_with(
            Bucket="digital-wardrobe-assets",
            Key=call_args["Key"],
        )

    asyncio.run(_run())


def test_storage_api_endpoint_security():
    """Test GET /api/v1/storage/{path} endpoint path traversal guards and 404 responses."""
    # 1. Path traversal attempt passed directly to the route handler should raise 400 Bad Request
    async def _test_traversal():
        with pytest.raises(HTTPException) as exc:
            await get_storage_file("../etc/passwd")
        assert exc.value.status_code == 400
        assert "path traversal" in exc.value.detail.lower()

    asyncio.run(_test_traversal())

    # 2. Non-existent image file via client should return 404 Not Found
    not_found_res = client.get("/api/v1/storage/non_existent_folder/missing_image_12345.png")
    assert not_found_res.status_code == 404
