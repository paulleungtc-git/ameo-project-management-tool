from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiToken, utcnow


def register(client: TestClient, email: str = "owner@example.com") -> str:
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
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_token(client: TestClient, jwt: str, name: str = "claude-mcp") -> dict:
    response = client.post(
        "/users/me/tokens",
        json={"name": name},
        headers=auth_header(jwt),
    )
    assert response.status_code == 201
    return response.json()


def test_create_token_returns_value_once_and_list_hides_it(client: TestClient) -> None:
    jwt = register(client)
    created = create_token(client, jwt)

    assert created["token"].startswith("ameo_pat_")
    assert created["token_prefix"] == created["token"][:14]

    listed = client.get("/users/me/tokens", headers=auth_header(jwt))
    assert listed.status_code == 200
    tokens = listed.json()
    assert len(tokens) == 1
    assert tokens[0]["name"] == "claude-mcp"
    assert "token" not in tokens[0]


def test_api_token_authenticates_requests(client: TestClient) -> None:
    jwt = register(client)
    pat = create_token(client, jwt)["token"]

    me = client.get("/auth/me", headers=auth_header(pat))
    assert me.status_code == 200
    assert me.json()["email"] == "owner@example.com"

    workspaces = client.get("/workspaces", headers=auth_header(pat))
    assert workspaces.status_code == 200


def test_api_token_updates_last_used(client: TestClient, db_session: Session) -> None:
    jwt = register(client)
    created = create_token(client, jwt)

    assert client.get("/auth/me", headers=auth_header(created["token"])).status_code == 200
    stored = db_session.scalar(select(ApiToken).where(ApiToken.id == created["id"]))
    assert stored is not None
    assert stored.last_used_at is not None


def test_revoked_token_is_rejected(client: TestClient) -> None:
    jwt = register(client)
    created = create_token(client, jwt)

    revoke = client.delete(f"/users/me/tokens/{created['id']}", headers=auth_header(jwt))
    assert revoke.status_code == 204

    rejected = client.get("/auth/me", headers=auth_header(created["token"]))
    assert rejected.status_code == 401


def test_expired_token_is_rejected(client: TestClient, db_session: Session) -> None:
    jwt = register(client)
    created = create_token(client, jwt)

    stored = db_session.scalar(select(ApiToken).where(ApiToken.id == created["id"]))
    assert stored is not None
    stored.expires_at = utcnow() - timedelta(minutes=1)
    db_session.commit()

    rejected = client.get("/auth/me", headers=auth_header(created["token"]))
    assert rejected.status_code == 401


def test_garbage_token_is_rejected(client: TestClient) -> None:
    register(client)
    rejected = client.get("/auth/me", headers=auth_header("ameo_pat_not-a-real-token"))
    assert rejected.status_code == 401


def test_api_token_cannot_manage_tokens(client: TestClient) -> None:
    jwt = register(client)
    created = create_token(client, jwt)
    pat = created["token"]

    assert (
        client.post(
            "/users/me/tokens",
            json={"name": "escalation"},
            headers=auth_header(pat),
        ).status_code
        == 403
    )
    assert client.get("/users/me/tokens", headers=auth_header(pat)).status_code == 403
    assert (
        client.delete(
            f"/users/me/tokens/{created['id']}",
            headers=auth_header(pat),
        ).status_code
        == 403
    )


def test_cannot_revoke_other_users_token(client: TestClient) -> None:
    owner_jwt = register(client)
    created = create_token(client, owner_jwt)

    other_jwt = register(client, email="other@example.com")
    response = client.delete(
        f"/users/me/tokens/{created['id']}",
        headers=auth_header(other_jwt),
    )
    assert response.status_code == 404


def test_token_expiry_is_set_from_days(client: TestClient) -> None:
    jwt = register(client)
    response = client.post(
        "/users/me/tokens",
        json={"name": "short-lived", "expires_in_days": 7},
        headers=auth_header(jwt),
    )
    assert response.status_code == 201
    assert response.json()["expires_at"] is not None
