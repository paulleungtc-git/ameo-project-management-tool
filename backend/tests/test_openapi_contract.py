from fastapi.testclient import TestClient


def test_openapi_contract_includes_core_routes(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/users/me" in paths
    assert "/users/me/password" in paths
    assert "/workspaces/{workspace_id}/members" in paths
    assert "/notifications" in paths
    assert "/attachments/tasks/{task_id}" in paths
