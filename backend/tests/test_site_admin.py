from fastapi.testclient import TestClient


def register(client: TestClient, email: str, name: str, workspace_name: str = "Ameo") -> dict:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": name,
            "password": "password123",
            "workspace_name": workspace_name,
        },
    )
    assert response.status_code == 201
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_first_user_can_bootstrap_site_admin(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")

    me_response = client.get("/auth/me", headers=auth_header(owner["access_token"]))
    assert me_response.status_code == 200
    assert me_response.json()["is_site_admin"] is False

    bootstrap_response = client.post(
        "/site-admin/bootstrap",
        headers=auth_header(owner["access_token"]),
    )
    assert bootstrap_response.status_code == 200
    assert bootstrap_response.json()["is_site_admin"] is True

    users_response = client.get(
        "/site-admin/users",
        headers=auth_header(owner["access_token"]),
    )
    assert users_response.status_code == 200
    assert [user["email"] for user in users_response.json()] == ["owner@example.com"]


def test_bootstrap_rejects_second_site_admin(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    other = register(client, "other@example.com", "Other", "Other")
    assert client.post("/site-admin/bootstrap", headers=auth_header(owner["access_token"])).status_code == 200

    response = client.post(
        "/site-admin/bootstrap",
        headers=auth_header(other["access_token"]),
    )
    assert response.status_code == 403


def test_site_admin_can_manage_user_site_access(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    other = register(client, "other@example.com", "Other", "Other")
    owner_headers = auth_header(owner["access_token"])
    other_headers = auth_header(other["access_token"])
    assert client.post("/site-admin/bootstrap", headers=owner_headers).status_code == 200

    forbidden = client.get("/site-admin/users", headers=other_headers)
    assert forbidden.status_code == 403

    promoted = client.patch(
        f"/site-admin/users/{other['user']['id']}",
        headers=owner_headers,
        json={"is_site_admin": True},
    )
    assert promoted.status_code == 200
    assert promoted.json()["is_site_admin"] is True

    allowed = client.get("/site-admin/users", headers=other_headers)
    assert allowed.status_code == 200
    assert {user["email"] for user in allowed.json()} == {"owner@example.com", "other@example.com"}
