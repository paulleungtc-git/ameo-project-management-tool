from fastapi.testclient import TestClient


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Owner",
            "password": "password123",
            "workspace_name": "Ameo",
        },
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_task(client: TestClient, headers: dict[str, str]) -> int:
    workspace_id = client.get("/workspaces", headers=headers).json()[0]["id"]
    project_id = client.post(
        "/projects",
        headers=headers,
        json={"workspace_id": workspace_id, "name": "Launch"},
    ).json()["id"]
    return client.post(
        "/tasks",
        headers=headers,
        json={"project_id": project_id, "title": "Comment task"},
    ).json()["id"]


def test_comments_and_activity(client: TestClient) -> None:
    headers = auth_headers(client)
    task_id = create_task(client, headers)

    comment_response = client.post(
        f"/tasks/{task_id}/comments",
        headers=headers,
        json={"body": "Looks good."},
    )
    assert comment_response.status_code == 201

    client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "In Progress"},
    )

    comments_response = client.get(f"/tasks/{task_id}/comments", headers=headers)
    assert comments_response.status_code == 200
    assert comments_response.json()[0]["body"] == "Looks good."

    activity_response = client.get(f"/tasks/{task_id}/activity", headers=headers)
    assert activity_response.status_code == 200
    event_types = [event["event_type"] for event in activity_response.json()]
    assert event_types == ["task.created", "comment.created", "task.updated"]
