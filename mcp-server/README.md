# Ameo MCP Server

Exposes the Ameo backend to AI agents over the Model Context Protocol (stdio).

Tools: `list_workspaces`, `list_projects`, `list_tasks`, `get_task`,
`comment_on_task`, `update_task_status`.

## Setup

```sh
cd mcp-server
python3 -m venv .venv
.venv/bin/pip install -e .
```

Create a personal access token (the backend must be running and you must be
signed in with email/password — API tokens cannot manage tokens):

```sh
curl -s -X POST http://localhost:8000/users/me/tokens \
  -H "Authorization: Bearer <jwt-from-login>" \
  -H "Content-Type: application/json" \
  -d '{"name": "claude-mcp"}' | jq -r .token
```

The token value is shown only once. Then register the server with Claude Code:

```sh
claude mcp add ameo \
  --env AMEO_API_URL=http://localhost:8000 \
  --env AMEO_API_TOKEN=ameo_pat_... \
  -- mcp-server/.venv/bin/python mcp-server/server.py
```

## Conventions

- A task description is the locked plan for that piece of work.
- Plan deviations go back as comments prefixed `[PLAN CHANGE PROPOSAL]` for a
  human to approve.
- The status-transition policy for agents lives in `check_status_change` in
  `server.py`.
