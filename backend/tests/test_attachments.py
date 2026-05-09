from typing import BinaryIO

from fastapi.testclient import TestClient

from app.storage import ObjectStorage, get_object_storage


class FakeStorage(ObjectStorage):
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    def put_file(self, key: str, body: BinaryIO, content_type: str) -> None:
        self.files[key] = body.read()


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
        json={"project_id": project_id, "title": "Attach file"},
    ).json()["id"]


def test_task_attachment_upload(client: TestClient) -> None:
    storage = FakeStorage()

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    app.dependency_overrides.pop(get_object_storage, None)

    assert response.status_code == 201
    payload = response.json()
    assert payload["filename"] == "note.txt"
    assert payload["byte_size"] == 5
    assert len(storage.files) == 1

    list_response = client.get(f"/attachments/tasks/{task_id}", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["filename"] == "note.txt"
