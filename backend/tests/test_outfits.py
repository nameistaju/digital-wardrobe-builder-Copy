from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_token(email: str = "outfit_tester@example.com") -> str:
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Outfit Tester"},
    )
    if res.status_code == 201:
        return res.json()["access_token"]
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    return login_res.json()["access_token"]


def test_outfit_crud():
    token = get_auth_token()

    # 1. Create outfit with canvas layout
    create_res = client.post(
        "/api/v1/outfits",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Weekend Minimalist Look",
            "description": "Clean white linen with relaxed navy chinos",
            "season": "summer",
            "occasion": "casual",
            "layout_data": [
                {"garment_id": 1, "x": 100.0, "y": 50.0, "width": 180.0, "height": 220.0, "z_index": 2, "rotation": 0.0},
                {"garment_id": 2, "x": 120.0, "y": 240.0, "width": 160.0, "height": 260.0, "z_index": 1, "rotation": 0.0},
            ],
            "is_favorite": True,
        },
    )
    assert create_res.status_code == 201
    outfit = create_res.json()
    assert outfit["name"] == "Weekend Minimalist Look"
    assert len(outfit["layout_data"]) == 2
    outfit_id = outfit["id"]

    # 2. List outfits
    list_res = client.get(
        "/api/v1/outfits",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Get single outfit
    get_res = client.get(
        f"/api/v1/outfits/{outfit_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == outfit_id

    # 4. Update outfit
    patch_res = client.patch(
        f"/api/v1/outfits/{outfit_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"occasion": "brunch", "name": "Sunday Brunch Capsule"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["occasion"] == "brunch"
    assert patch_res.json()["name"] == "Sunday Brunch Capsule"

    # 5. Delete outfit
    del_res = client.delete(
        f"/api/v1/outfits/{outfit_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204
