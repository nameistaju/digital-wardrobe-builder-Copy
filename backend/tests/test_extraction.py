import io
import time
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app

client = TestClient(app)


def get_auth_token(email: str = "extractor_user@example.com") -> str:
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Extractor User"},
    )
    if res.status_code == 201:
        return res.json()["access_token"]
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    return login_res.json()["access_token"]


def create_full_body_dummy_image() -> io.BytesIO:
    # 200x400 fashion dummy image
    img = Image.new("RGB", (200, 400), color=(240, 235, 230))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


def test_extraction_workflow():
    token = get_auth_token()
    img_buf = create_full_body_dummy_image()

    # 1. Upload for extraction
    res = client.post(
        "/api/v1/extraction/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("full_body.jpg", img_buf, "image/jpeg")},
    )
    assert res.status_code == 202
    job_data = res.json()
    job_id = job_data["id"]

    # 2. In TestClient, background tasks run synchronously during the request
    # Let's verify job is completed and candidates exist
    get_res = client.get(
        f"/api/v1/extraction/{job_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    job_info = get_res.json()
    assert job_info["status"] == "completed"
    candidates = job_info["candidate_garments"]
    assert len(candidates) >= 1

    first_cand = candidates[0]
    cand_id = first_cand["id"]

    # 3. Approve candidate to wardrobe
    approve_res = client.post(
        f"/api/v1/extraction/{job_id}/candidates/{cand_id}/approve",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Approved AI Garment",
            "category": "tops",
            "color": "beige",
        },
    )
    assert approve_res.status_code == 200
    new_garment = approve_res.json()
    assert new_garment["name"] == "Approved AI Garment"
    assert new_garment["source_type"] == "extracted_outfit"

    # 4. Reject another candidate if present
    if len(candidates) > 1:
        second_cand = candidates[1]
        reject_res = client.post(
            f"/api/v1/extraction/{job_id}/candidates/{second_cand['id']}/reject",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert reject_res.status_code == 200
