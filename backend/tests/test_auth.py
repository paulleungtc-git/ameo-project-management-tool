from fastapi.testclient import TestClient


def test_register_login_and_me(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Owner",
            "password": "password123",
            "workspace_name": "Ameo",
        },
    )
    assert register_response.status_code == 201
    token = register_response.json()["access_token"]

    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "owner@example.com"

    login_response = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["name"] == "Owner"


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    payload = {
        "email": "owner@example.com",
        "name": "Owner",
        "password": "password123",
        "workspace_name": "Ameo",
    }
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 409
