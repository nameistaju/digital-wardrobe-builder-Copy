import io
import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException
from PIL import Image
import pytest

from app.main import app
from app.core.config import settings

client = TestClient(app)


def get_auth_token(prefix: str = "tryon_user") -> str:
    uid = uuid.uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "TryOn Tester"},
    )
    return res.json()["access_token"]


def create_test_image_bytes(color=(200, 100, 100)) -> bytes:
    img = Image.new("RGB", (200, 300), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_tryon_status():
    res = client.get("/api/v1/try-on/status")
    assert res.status_code == 200
    data = res.json()
    assert "is_configured" in data
    assert "model_name" in data
    assert data["model_name"] == "IDM-VTON (ECCV 2024)"
    assert "endpoint" in data
    assert "status" in data
    assert data["status"] in ("available", "unavailable", "quota_exceeded")


def test_tryon_missing_garment_validation():
    token = get_auth_token("missing_garment")
    person_img = create_test_image_bytes()

    res = client.post(
        "/api/v1/try-on/generate",
        headers={"Authorization": f"Bearer {token}"},
        files={"person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg")},
    )
    assert res.status_code == 400
    assert "Either a garment image file or an existing garment_id must be provided" in res.json()["detail"]


def test_tryon_missing_hf_token():
    token = get_auth_token("no_hf_token")
    person_img = create_test_image_bytes()
    garment_img = create_test_image_bytes((50, 150, 50))

    with patch.object(settings, "HF_TOKEN", None):
        res = client.post(
            "/api/v1/try-on/generate",
            headers={"Authorization": f"Bearer {token}"},
            files={
                "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                "garment_image": ("garment.jpg", io.BytesIO(garment_img), "image/jpeg"),
            },
        )
        assert res.status_code == 503
        assert "HF_TOKEN is not configured" in res.json()["detail"]


def test_tryon_successful_generation_idm_vton():
    token = get_auth_token("success_idm_vton")
    person_img = create_test_image_bytes((120, 150, 180))
    garment_img = create_test_image_bytes((220, 80, 50))
    mock_result_bytes = create_test_image_bytes((100, 200, 100))

    with patch("app.api.v1.tryon.call_idm_vton", return_value=mock_result_bytes):
        res = client.post(
            "/api/v1/try-on/generate",
            headers={"Authorization": f"Bearer {token}"},
            files={
                "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                "garment_image": ("jacket.jpg", io.BytesIO(garment_img), "image/jpeg"),
            },
            data={"prompt": "Hot Wheels racing T-shirt"},
        )

        assert res.status_code == 201
        data = res.json()
        assert data["id"] > 0
        assert "tryon/results" in data["result_image_url"]
        assert "tryon/persons" in data["person_image_url"]
        assert "tryon/garments" in data["garment_image_url"]
        assert data["prompt"] == "Hot Wheels racing T-shirt"
        assert data["status"] == "completed"

        # Check history has exactly this look
        hist_res = client.get(
            "/api/v1/try-on/history",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hist_res.status_code == 200
        hist = hist_res.json()
        assert hist["total"] >= 1
        assert hist["items"][0]["id"] == data["id"]


def test_tryon_with_existing_wardrobe_garment():
    token = get_auth_token("wardrobe_tryon")

    # 1. Upload a garment to wardrobe first
    garment_buf = create_test_image_bytes((40, 90, 200))
    upload_res = client.post(
        "/api/v1/garments/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("blue_blazer.jpg", io.BytesIO(garment_buf), "image/jpeg")},
        data={"name": "Navy Blazer", "category": "outerwear"},
    )
    assert upload_res.status_code == 201
    garment_id = upload_res.json()["id"]

    # 2. Call try-on referencing garment_id with mock
    person_img = create_test_image_bytes()
    mock_result_bytes = create_test_image_bytes((60, 60, 180))

    with patch("app.api.v1.tryon.call_idm_vton", return_value=mock_result_bytes):
        res = client.post(
            "/api/v1/try-on/generate",
            headers={"Authorization": f"Bearer {token}"},
            files={"person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg")},
            data={"garment_id": garment_id},
        )

        assert res.status_code == 201
        data = res.json()
        assert data["garment_id"] == garment_id
        assert "garments" in data["garment_image_url"]


def test_tryon_failure_does_not_save_history():
    token = get_auth_token("fail_no_history")
    person_img = create_test_image_bytes((120, 150, 180))
    garment_img = create_test_image_bytes((220, 80, 50))

    with patch(
        "app.api.v1.tryon.call_idm_vton",
        side_effect=HTTPException(status_code=502, detail="ZeroGPU error"),
    ):
        res = client.post(
            "/api/v1/try-on/generate",
            headers={"Authorization": f"Bearer {token}"},
            files={
                "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                "garment_image": ("jacket.jpg", io.BytesIO(garment_img), "image/jpeg"),
            },
        )
        assert res.status_code == 502

        # Verify no record created in history
        hist_res = client.get(
            "/api/v1/try-on/history",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert hist_res.status_code == 200
        assert hist_res.json()["total"] == 0


def test_tryon_without_auth_guest_mode():
    """Verifies that users can generate virtual try-ons without any sign in or Authorization header."""
    person_img = create_test_image_bytes((120, 150, 180))
    garment_img = create_test_image_bytes((220, 80, 50))
    mock_result_bytes = create_test_image_bytes((100, 200, 100))

    with patch("app.api.v1.tryon.call_idm_vton", return_value=mock_result_bytes):
        # Request with NO headers at all
        res = client.post(
            "/api/v1/try-on/generate",
            files={
                "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                "garment_image": ("jacket.jpg", io.BytesIO(garment_img), "image/jpeg"),
            },
            data={"prompt": "Guest try-on without signing in"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["id"] > 0
        assert data["status"] == "completed"

        # Verify history is also accessible without auth
        hist_res = client.get("/api/v1/try-on/history")
        assert hist_res.status_code == 200
        assert len(hist_res.json()["items"]) >= 1

