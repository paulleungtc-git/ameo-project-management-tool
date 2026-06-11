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


def test_project_and_task_crud(client: TestClient) -> None:
    headers = auth_headers(client)
    workspaces = client.get("/workspaces", headers=headers).json()
    workspace_id = workspaces[0]["id"]

    project_response = client.post(
        "/projects",
        headers=headers,
        json={"workspace_id": workspace_id, "name": "Launch", "description": "Ship MVP"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/tasks",
        headers=headers,
        json={
            "project_id": project_id,
            "title": "Create task API",
            "status": "Todo",
            "priority": "High",
        },
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    update_response = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "In Progress"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "In Progress"

    list_response = client.get(f"/tasks?workspace_id={workspace_id}", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = client.get(f"/tasks/{task_id}", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Create task API"

    assert client.get("/tasks/999999", headers=headers).status_code == 404


def test_task_rejects_invalid_status(client: TestClient) -> None:
    headers = auth_headers(client)
    workspace_id = client.get("/workspaces", headers=headers).json()[0]["id"]
    project_id = client.post(
        "/projects",
        headers=headers,
        json={"workspace_id": workspace_id, "name": "Launch"},
    ).json()["id"]

    response = client.post(
        "/tasks",
        headers=headers,
        json={"project_id": project_id, "title": "Bad status", "status": "Blocked"},
    )
    assert response.status_code == 422


def test_project_and_task_filters(client: TestClient) -> None:
    headers = auth_headers(client)
    workspace_id = client.get("/workspaces", headers=headers).json()[0]["id"]
    launch_id = client.post(
        "/projects",
        headers=headers,
        json={"workspace_id": workspace_id, "name": "Launch", "description": "Public beta"},
    ).json()["id"]
    ops_id = client.post(
        "/projects",
        headers=headers,
        json={"workspace_id": workspace_id, "name": "Operations", "description": "Internal"},
    ).json()["id"]

    client.post(
        "/tasks",
        headers=headers,
        json={
            "project_id": launch_id,
            "title": "Write beta checklist",
            "description": "Customer launch tasks",
            "status": "Review",
            "priority": "High",
            "due_date": "2026-05-20",
        },
    )
    client.post(
        "/tasks",
        headers=headers,
        json={
            "project_id": ops_id,
            "title": "Prepare invoice labels",
            "status": "Todo",
            "priority": "Low",
            "due_date": "2026-06-01",
        },
    )

    project_search = client.get(f"/projects?workspace_id={workspace_id}&q=beta", headers=headers)
    assert project_search.status_code == 200
    assert [project["name"] for project in project_search.json()] == ["Launch"]

    task_search = client.get(
        f"/tasks?workspace_id={workspace_id}&q=launch&status=Review&priority=High"
        "&due_from=2026-05-01&due_to=2026-05-31",
        headers=headers,
    )
    assert task_search.status_code == 200
    assert [task["title"] for task in task_search.json()] == ["Write beta checklist"]

    project_filter = client.get(f"/tasks?workspace_id={workspace_id}&project_id={ops_id}", headers=headers)
    assert project_filter.status_code == 200
    assert [task["title"] for task in project_filter.json()] == ["Prepare invoice labels"]
