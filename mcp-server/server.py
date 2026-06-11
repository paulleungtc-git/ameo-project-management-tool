"""Ameo MCP server.

Wraps the Ameo backend REST API so AI agents can read and update tickets.
Authentication uses an Ameo personal access token (create one via
POST /users/me/tokens while signed in with email/password).

Environment:
    AMEO_API_URL    Backend base URL (default http://localhost:8000)
    AMEO_API_TOKEN  Personal access token (ameo_pat_...), required
"""

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("AMEO_API_URL", "http://localhost:8000")
API_TOKEN = os.environ.get("AMEO_API_TOKEN", "")

VALID_STATUSES = ["Backlog", "Todo", "In Progress", "Review", "Done"]

mcp = FastMCP("ameo")


def _request(method: str, path: str, **kwargs: Any) -> Any:
    if not API_TOKEN:
        raise RuntimeError("AMEO_API_TOKEN is not set; create a token in Ameo first")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    with httpx.Client(base_url=API_URL, headers=headers, timeout=30) as client:
        response = client.request(method, path, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Ameo API {method} {path} failed ({response.status_code}): {response.text}",
        )
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


def check_status_change(task: dict[str, Any], new_status: str) -> None:
    """Workflow policy gate for agent-driven status changes.

    Raise RuntimeError to block a transition. By default all transitions are
    allowed. This is the place to encode rules like "an agent may move a task
    to Review, but only a human marks it Done."
    """
    # TODO(user): define the status-transition policy for AI agents here.
    # `task` is the current task dict (task["status"] is the current status),
    # `new_status` is the requested target, guaranteed to be in VALID_STATUSES.


@mcp.tool()
def list_workspaces() -> list[dict[str, Any]]:
    """List workspaces the token's user belongs to."""
    return _request("GET", "/workspaces")


@mcp.tool()
def list_projects(workspace_id: int) -> list[dict[str, Any]]:
    """List projects in a workspace."""
    return _request("GET", "/projects", params={"workspace_id": workspace_id})


@mcp.tool()
def list_tasks(
    workspace_id: int,
    project_id: int | None = None,
    status: str | None = None,
    assignee_id: int | None = None,
    query: str | None = None,
) -> list[dict[str, Any]]:
    """List tasks in a workspace, optionally filtered.

    status must be one of: Backlog, Todo, In Progress, Review, Done.
    query searches task titles and descriptions.
    """
    params: dict[str, Any] = {"workspace_id": workspace_id}
    if project_id is not None:
        params["project_id"] = project_id
    if status is not None:
        params["status"] = status
    if assignee_id is not None:
        params["assignee_id"] = assignee_id
    if query is not None:
        params["q"] = query
    return _request("GET", "/tasks", params=params)


@mcp.tool()
def get_task(task_id: int) -> dict[str, Any]:
    """Get a task with its full description (the locked plan) and all comments."""
    task = _request("GET", f"/tasks/{task_id}")
    task["comments"] = _request("GET", f"/tasks/{task_id}/comments")
    return task


@mcp.tool()
def comment_on_task(task_id: int, body: str) -> dict[str, Any]:
    """Add a comment to a task.

    Use this for progress notes and for plan-change proposals. Prefix
    plan-change proposals with "[PLAN CHANGE PROPOSAL]" so a human can find
    and approve them before the plan deviates.
    """
    return _request("POST", f"/tasks/{task_id}/comments", json={"body": body})


@mcp.tool()
def update_task_status(task_id: int, status: str) -> dict[str, Any]:
    """Move a task to a new status.

    status must be one of: Backlog, Todo, In Progress, Review, Done.
    """
    if status not in VALID_STATUSES:
        raise RuntimeError(f"Invalid status {status!r}; expected one of {VALID_STATUSES}")
    task = _request("GET", f"/tasks/{task_id}")
    check_status_change(task, status)
    return _request("PATCH", f"/tasks/{task_id}", json={"status": status})


if __name__ == "__main__":
    mcp.run()
