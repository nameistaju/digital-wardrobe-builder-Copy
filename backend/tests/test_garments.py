import io
import uuid
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app

client = TestClient(app)


def get_auth_token(prefix: str = "user") -> str:
    uid = uuid.uuid4().hex[:8]
    email = f"{prefix}_{uid}@example.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Garment Tester"},
    )
    return res.json()["access_token"]


def create_dummy_image() -> io.BytesIO:
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_garment_crud_and_isolation():
    token1 = get_auth_token("user1")
    token2 = get_auth_token("user2")

    # 1. Upload garment for User 1
    dummy_img = create_dummy_image()
    upload_res = client.post(
        "/api/v1/garments/upload",
        headers={"Authorization": f"Bearer {token1}"},
        files={"file": ("test_shirt.png", dummy_img, "image/png")},
        data={
            "name": "Classic White Shirt",
            "category": "tops",
            "color": "white",
            "season": "summer",
            "is_favorite": "true",
            "remove_background": "false",
        },
    )
    assert upload_res.status_code == 201
    garment = upload_res.json()
    assert garment["name"] == "Classic White Shirt"
    assert garment["category"] == "tops"
    assert garment["is_favorite"] is True
    garment_id = garment["id"]

    # 2. List garments for User 1
    list_res = client.get(
        "/api/v1/garments",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 3. User 2 cannot access User 1's garment (User data isolation)
    isolated_get = client.get(
        f"/api/v1/garments/{garment_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert isolated_get.status_code == 404

    # 4. Update garment
    patch_res = client.patch(
        f"/api/v1/garments/{garment_id}",
        headers={"Authorization": f"Bearer {token1}"},
        json={"name": "Oxford White Shirt", "brand": "Minimal Co."},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Oxford White Shirt"
    assert patch_res.json()["brand"] == "Minimal Co."

    # 5. Category counts
    cats_res = client.get(
        "/api/v1/garments/categories",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert cats_res.status_code == 200
    counts = {c["category"]: c["count"] for c in cats_res.json()}
    assert counts.get("tops", 0) >= 1

    # 6. Delete garment
    del_res = client.delete(
        f"/api/v1/garments/{garment_id}",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert del_res.status_code == 204
