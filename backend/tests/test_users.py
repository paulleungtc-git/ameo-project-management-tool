from fastapi.testclient import TestClient


def register(client: TestClient, email: str = "owner@example.com") -> dict:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Owner",
            "password": "password123",
            "workspace_name": "Ameo",
        },
    )
    assert response.status_code == 201
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_user_can_update_profile(client: TestClient) -> None:
    auth = register(client)
    headers = auth_header(auth["access_token"])

    response = client.patch(
        "/users/me",
        headers=headers,
        json={"name": "Updated Owner", "email": "updated@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Owner"
    assert response.json()["email"] == "updated@example.com"

    old_login = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "password123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"email": "updated@example.com", "password": "password123"},
    )
    assert new_login.status_code == 200


def test_user_update_rejects_duplicate_email(client: TestClient) -> None:
    owner = register(client, "owner@example.com")
    register(client, "other@example.com")

    response = client.patch(
        "/users/me",
        headers=auth_header(owner["access_token"]),
        json={"email": "other@example.com"},
    )

    assert response.status_code == 409


def test_user_can_update_password(client: TestClient) -> None:
    auth = register(client)
    headers = auth_header(auth["access_token"])

    wrong_current = client.patch(
        "/users/me/password",
        headers=headers,
        json={"current_password": "wrong-password", "new_password": "newpassword123"},
    )
    assert wrong_current.status_code == 401

    update_response = client.patch(
        "/users/me/password",
        headers=headers,
        json={"current_password": "password123", "new_password": "newpassword123"},
    )
    assert update_response.status_code == 204

    old_login = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "password123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "newpassword123"},
    )
    assert new_login.status_code == 200
