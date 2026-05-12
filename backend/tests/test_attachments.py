from typing import BinaryIO

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.storage import ObjectStorage, get_object_storage


class FakeStorage(ObjectStorage):
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.deleted: list[str] = []

    def put_file(self, key: str, body: BinaryIO, content_type: str) -> None:
        self.files[key] = body.read()

    def get_file(self, key: str) -> bytes:
        return self.files[key]

    def delete_file(self, key: str) -> None:
        self.deleted.append(key)
        self.files.pop(key, None)


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


def test_task_attachment_rejects_empty_file(client: TestClient) -> None:
    storage = FakeStorage()

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    app.dependency_overrides.pop(get_object_storage, None)

    assert response.status_code == 422
    assert storage.files == {}


def test_task_attachment_rejects_unsupported_content_type(client: TestClient) -> None:
    storage = FakeStorage()

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("script.sh", b"echo hi", "application/x-sh")},
    )
    app.dependency_overrides.pop(get_object_storage, None)

    assert response.status_code == 415
    assert storage.files == {}


def test_task_attachment_rejects_large_file(client: TestClient) -> None:
    storage = FakeStorage()
    settings = Settings(ATTACHMENT_MAX_BYTES=4)

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    app.dependency_overrides[get_settings] = lambda: settings
    response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("large.txt", b"hello", "text/plain")},
    )
    app.dependency_overrides.pop(get_object_storage, None)
    app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 413
    assert storage.files == {}


def test_task_attachment_sanitizes_filename(client: TestClient) -> None:
    storage = FakeStorage()

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("../bad/name?.txt", b"hello", "text/plain")},
    )
    app.dependency_overrides.pop(get_object_storage, None)

    assert response.status_code == 201
    assert response.json()["filename"] == "name_.txt"


def test_task_attachment_download_and_delete(client: TestClient) -> None:
    storage = FakeStorage()

    headers = auth_headers(client)
    task_id = create_task(client, headers)
    app = client.app
    app.dependency_overrides[get_object_storage] = lambda: storage
    upload_response = client.post(
        f"/attachments/tasks/{task_id}",
        headers=headers,
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    attachment_id = upload_response.json()["id"]

    download_response = client.get(f"/attachments/{attachment_id}/download", headers=headers)
    assert download_response.status_code == 200
    assert download_response.content == b"hello"
    assert download_response.headers["content-type"] == "text/plain; charset=utf-8"

    delete_response = client.delete(f"/attachments/{attachment_id}", headers=headers)
    app.dependency_overrides.pop(get_object_storage, None)

    assert delete_response.status_code == 204
    assert storage.files == {}
    assert len(storage.deleted) == 1
    list_response = client.get(f"/attachments/tasks/{task_id}", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json() == []
