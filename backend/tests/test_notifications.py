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


def test_assigned_member_receives_and_reads_notification(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    member = register(client, "member@example.com", "Member", "Other")
    owner_headers = auth_header(owner["access_token"])
    member_headers = auth_header(member["access_token"])
    workspace_id = client.get("/workspaces", headers=owner_headers).json()[0]["id"]
    client.post(
        f"/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"email": member["user"]["email"], "role": "member"},
    )
    project_id = client.post(
        "/projects",
        headers=owner_headers,
        json={"workspace_id": workspace_id, "name": "Launch"},
    ).json()["id"]

    client.post(
        "/tasks",
        headers=owner_headers,
        json={"project_id": project_id, "title": "Prepare plan", "assignee_id": member["user"]["id"]},
    )

    list_response = client.get(f"/notifications?workspace_id={workspace_id}&unread_only=true", headers=member_headers)
    assert list_response.status_code == 200
    notifications = list_response.json()
    assert len(notifications) == 1
    assert notifications[0]["event_type"] == "task.assigned"

    read_response = client.patch(f"/notifications/{notifications[0]['id']}/read", headers=member_headers)
    assert read_response.status_code == 200
    assert read_response.json()["read_at"] is not None

    unread_response = client.get(f"/notifications?workspace_id={workspace_id}&unread_only=true", headers=member_headers)
    assert unread_response.status_code == 200
    assert unread_response.json() == []


def test_comment_notifies_task_assignee(client: TestClient) -> None:
    owner = register(client, "owner@example.com", "Owner")
    member = register(client, "member@example.com", "Member", "Other")
    owner_headers = auth_header(owner["access_token"])
    member_headers = auth_header(member["access_token"])
    workspace_id = client.get("/workspaces", headers=owner_headers).json()[0]["id"]
    client.post(
        f"/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"email": member["user"]["email"], "role": "member"},
    )
    project_id = client.post(
        "/projects",
        headers=owner_headers,
        json={"workspace_id": workspace_id, "name": "Launch"},
    ).json()["id"]
    task_id = client.post(
        "/tasks",
        headers=owner_headers,
        json={"project_id": project_id, "title": "Review notes", "assignee_id": member["user"]["id"]},
    ).json()["id"]
    client.patch(f"/notifications/1/read", headers=member_headers)

    comment_response = client.post(
        f"/tasks/{task_id}/comments",
        headers=owner_headers,
        json={"body": "Please review the latest notes."},
    )
    assert comment_response.status_code == 201

    notifications = client.get(
        f"/notifications?workspace_id={workspace_id}&unread_only=true",
        headers=member_headers,
    ).json()
    assert [notification["event_type"] for notification in notifications] == ["comment.created"]
