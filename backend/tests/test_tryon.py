import base64
import io
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
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
    assert "endpoint" in data
    assert "NVIDIA" in data["model_name"]
    assert len(data["model_name"]) > 0


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


def test_tryon_missing_api_key():
    token = get_auth_token("no_key")
    person_img = create_test_image_bytes()
    garment_img = create_test_image_bytes((50, 150, 50))

    with patch.object(settings, "NVIDIA_API_KEY", None):
        res = client.post(
            "/api/v1/try-on/generate",
            headers={"Authorization": f"Bearer {token}"},
            files={
                "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                "garment_image": ("garment.jpg", io.BytesIO(garment_img), "image/jpeg"),
            },
        )
        assert res.status_code == 503
        assert "NVIDIA_API_KEY is not configured" in res.json()["detail"]


def test_tryon_successful_generation_qwen():
    token = get_auth_token("success_user_qwen")
    person_img = create_test_image_bytes((120, 150, 180))
    garment_img = create_test_image_bytes((220, 80, 50))
    mock_result_bytes = create_test_image_bytes((100, 200, 100))

    with patch.object(settings, "NVIDIA_API_KEY", "nvapi-test-mock-key"):
        with patch("app.services.nvidia_tryon.call_nvidia_qwen_image_edit", return_value=mock_result_bytes):
            res = client.post(
                "/api/v1/try-on/generate",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                    "garment_image": ("dress.jpg", io.BytesIO(garment_img), "image/jpeg"),
                },
                data={"prompt": "Realistic drape over shoulders"},
            )

            assert res.status_code == 201
            data = res.json()
            assert data["id"] > 0
            assert "tryon/results" in data["result_image_url"]
            assert "tryon/persons" in data["person_image_url"]
            assert "tryon/garments" in data["garment_image_url"]
            assert data["prompt"] == "Realistic drape over shoulders"
            assert data["status"] == "completed"

            # Check history
            hist_res = client.get(
                "/api/v1/try-on/history",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert hist_res.status_code == 200
            hist = hist_res.json()
            assert hist["total"] >= 1
            assert hist["items"][0]["id"] == data["id"]


def test_tryon_successful_generation_qwen_image_model():
    token = get_auth_token("success_qwen_image")
    person_img = create_test_image_bytes((110, 140, 170))
    garment_img = create_test_image_bytes((210, 70, 40))
    mock_result_bytes = create_test_image_bytes((90, 190, 90))

    with patch.object(settings, "NVIDIA_API_KEY", "nvapi-test-mock-key"):
        with patch("app.services.nvidia_tryon.call_nvidia_qwen_image", return_value=mock_result_bytes):
            res = client.post(
                "/api/v1/try-on/generate",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "person_image": ("person.jpg", io.BytesIO(person_img), "image/jpeg"),
                    "garment_image": ("jacket.jpg", io.BytesIO(garment_img), "image/jpeg"),
                },
                data={"prompt": "Stylish leather jacket", "model": "qwen-image"},
            )

            assert res.status_code == 201
            data = res.json()
            assert data["id"] > 0
            assert data["status"] == "completed"


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

    with patch.object(settings, "NVIDIA_API_KEY", "nvapi-test-mock-key"):
        with patch("app.services.nvidia_tryon.call_nvidia_qwen_image_edit", return_value=mock_result_bytes):
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
