from fastapi.testclient import TestClient


def register(
    client: TestClient,
    email: str,
    name: str,
    workspace_name: str = "Ameo",
) -> dict:
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


def test_workspace_admin_can_manage_existing_members(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    member_user = register(client, "member@example.com", "Member", "Other")
    workspace_id = client.get("/workspaces", headers=auth_header(owner["access_token"])).json()[0]["id"]

    add_response = client.post(
        f"/workspaces/{workspace_id}/members",
        headers=auth_header(owner["access_token"]),
        json={"email": member_user["user"]["email"], "role": "member"},
    )
    assert add_response.status_code == 201
    member_id = add_response.json()["id"]

    list_response = client.get(f"/workspaces/{workspace_id}/members", headers=auth_header(owner["access_token"]))
    assert list_response.status_code == 200
    assert {member["email"] for member in list_response.json()} == {"owner@example.com", "member@example.com"}

    update_response = client.patch(
        f"/workspaces/{workspace_id}/members/{member_id}",
        headers=auth_header(owner["access_token"]),
        json={"role": "admin"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["role"] == "admin"

    delete_response = client.delete(
        f"/workspaces/{workspace_id}/members/{member_id}",
        headers=auth_header(owner["access_token"]),
    )
    assert delete_response.status_code == 204


def test_workspace_member_cannot_manage_members(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    member_user = register(client, "member@example.com", "Member", "Other")
    workspace_id = client.get("/workspaces", headers=auth_header(owner["access_token"])).json()[0]["id"]
    client.post(
        f"/workspaces/{workspace_id}/members",
        headers=auth_header(owner["access_token"]),
        json={"email": member_user["user"]["email"], "role": "member"},
    )

    response = client.post(
        f"/workspaces/{workspace_id}/members",
        headers=auth_header(member_user["access_token"]),
        json={"email": "owner@example.com", "role": "member"},
    )
    assert response.status_code == 403


def test_workspace_keeps_an_owner(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    workspace_id = client.get("/workspaces", headers=auth_header(owner["access_token"])).json()[0]["id"]
    members = client.get(f"/workspaces/{workspace_id}/members", headers=auth_header(owner["access_token"])).json()
    owner_member_id = members[0]["id"]

    response = client.patch(
        f"/workspaces/{workspace_id}/members/{owner_member_id}",
        headers=auth_header(owner["access_token"]),
        json={"role": "admin"},
    )
    assert response.status_code == 422
