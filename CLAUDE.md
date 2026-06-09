# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other coding
agents when working with code in this repository.

## Working on this repo

These rules apply to every change in this repo.

### 1. Plan before non-trivial code

For anything more than a one-line tweak, state the proposed approach and main
trade-off in 2-3 sentences before writing files. Bug fixes with an obvious root
cause can go straight to the fix.

The goal is cheap redirection: if the approach is wrong, catch it before a large
patch exists.

### 2. Verify dependency versions from the registry

Before writing or editing any dependency manifest (`package.json`,
`pyproject.toml`, `pubspec.yaml`, `Cargo.toml`, etc.), query the package
registry instead of relying on memory.

```sh
# npm
curl -s "https://registry.npmjs.org/<package>" | jq -r '.["dist-tags"].latest'

# Python
curl -s "https://pypi.org/pypi/<package>/json" | jq -r .info.version

# Dart / Flutter
curl -s "https://pub.dev/api/packages/<package>" | jq -r .latest.version
```

If an update crosses a major version or skips several minor versions, check the
official changelog or migration notes before changing the manifest. After a
dependency change, run the package-manager resolver and focused tests.

### 3. Keep docs current

When changing architecture, runtime behavior, public APIs, configuration, or
developer workflows, update the relevant documentation in the same change.

At minimum, keep this file current with:

- Repository layout and major module boundaries.
- Common local development commands.
- Environment variables or service prerequisites.
- Testing and release expectations.

### 4. Ground suggestions

For meaningful architectural suggestions, include the basis for the
recommendation: a known pattern, framework convention, standard, or comparable
product behavior. If it is only a preference, label it as such.

### 5. Keep CLI table output readable

Chat output is often read in a terminal-style renderer. This rule is about
CLI-rendered tables in agent responses, not database tables or schema design.
Wide Markdown pipe tables wrap badly and become hard to read.

For any CLI-facing table, prefer a fixed-width boxed ASCII table:

```text
+------+----------------+----------------------------------+
| Area | Suggested Move | Reason                           |
+------+----------------+----------------------------------+
| CP   | Rerun only     | Evidence is stale after changes. |
+------+----------------+----------------------------------+
```

## Project context

This repository is for the Ameo project management tool: a lightweight project
management product across web and mobile.

The product should stay focused on small-team project tracking, not heavy
enterprise workflow configuration. The first useful loop should cover:

- Workspaces and members.
- Projects.
- Tasks with status, priority, assignee, due date, and description.
- Comments and activity history.
- Attachments on tasks first, then comments if needed.
- Search and filtering.
- Web dashboard for planning/review.
- Mobile views for capture, personal task lists, updates, comments, and
  attachment uploads.

## Architecture direction

Use a shared backend with separate web and mobile clients unless a later product
decision changes this.

Recommended starting layout:

```text
ameo-project-management-tool/
+-- backend/
+-- web/
+-- mobile/
+-- docs/
```

Locked baseline:

- Backend: FastAPI.
- Database: PostgreSQL.
- Web: Next.js with TypeScript.
- Mobile: Flutter.
- API contract: OpenAPI generated from the backend.
- Realtime: start with polling; add WebSocket or SSE only when product behavior
  needs it.
- Deployment: Docker Compose first.
- Auth: email/password first.
- Task workflow: fixed statuses first.
- User roles: Owner, Admin, Member first. Leave room for later imported or
  external users without overbuilding that flow now.
- Build sequence: backend and web first, mobile after the API/product model is
  stable.

Keep the backend as the product source of truth for workspaces, projects, tasks,
comments, attachments, activity, permissions, and notifications.

Initial task statuses:

```text
Backlog -> Todo -> In Progress -> Review -> Done
```

Use a global fixed status order first.

## Attachment direction

Use an S3-compatible storage adapter in the backend. Do not couple application
code directly to one object-storage vendor.

Chosen default for self-hosted Docker deployments: **Garage**.

Rationale:

- Garage is S3-compatible and works well behind standard AWS S3 SDKs.
- It has an official Docker image (`dxflrs/garage`).
- It is lightweight enough for this app's attachment use case.
- It avoids starting a new project on MinIO Community Edition, whose upstream
  repository is archived/read-only.
- It is much simpler to operate than Ceph for this product.

License note: Garage is AGPLv3. Normal use through the official Docker image as
an object-storage service is acceptable for this project direction. Do not modify
Garage itself unless the license obligations have been reviewed.

Store file bytes in Garage and metadata in PostgreSQL. A minimal attachment
model should include:

```text
attachments
- id
- workspace_id
- owner_type
- owner_id
- uploaded_by
- filename
- content_type
- byte_size
- storage_key
- checksum
- created_at
```

Start with task attachments using backend-streamed uploads. Add comment
attachments and direct-to-Garage signed uploads after the task/comment flow is
stable.

Expected Docker services once implementation begins:

```text
postgres
garage
backend
web
```

Expected backend environment shape:

```env
S3_ENDPOINT=http://garage:3900
S3_BUCKET=attachments
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=garage
S3_FORCE_PATH_STYLE=true
```

## Locked decisions

Use these choices when scaffolding the app:

```text
+---------------+----------------------+
| Area          | Decision             |
+---------------+----------------------+
| Backend       | FastAPI              |
| Web           | Next.js + TypeScript |
| Mobile        | Flutter              |
| Database      | PostgreSQL           |
| Attachments   | Garage               |
| Deployment    | Docker Compose first |
| Auth          | Email/password first |
| Task workflow | Fixed statuses first |
| User roles    | Owner/Admin/Member   |
| First build   | Backend + web        |
+---------------+----------------------+
```

Implementation defaults:

- Attachment upload flow: backend-streamed upload first.
- Fixed statuses: Backlog, Todo, In Progress, Review, Done.
- Status order: global fixed order first.
- Notification sequence: in-app first, email later, push later.
- Leave space in the user model for later imported/external users.

## Conventions

- Prefer existing project patterns once they exist.
- Keep changes focused on the requested behavior.
- Do not introduce dependencies without a clear reason.
- Do not log secrets or include them in errors.
- Use structured parsers or framework APIs instead of ad hoc string handling
  when practical.
- Add tests in proportion to risk and blast radius.

## Common commands

```sh
# Backend tests
backend/.venv/bin/pytest backend/tests

# Web verification
npm run lint --prefix web
npm run build --prefix web

# OpenAPI contract export
backend/.venv/bin/python backend/scripts/export_openapi.py

# Mobile verification
flutter analyze mobile
flutter test mobile
```

## Homelab deployment

Gitea Actions deploys backend and web to the homelab VM at `192.168.210.249`
using `.gitea/workflows/deploy-homelab.yml`.

Required Gitea values:

- Repository secret `SSH_NAME`: SSH username on the VM.
- Repository secret `SSH_PWD`: SSH password on the VM.
- Optional repository secret `AMEO_ENV`: full `.env` contents for the remote
  Docker Compose app.

The workflow builds and pushes:

```text
registry.lab.pltc.me/$GITHUB_REPOSITORY-backend:$GITHUB_SHA
registry.lab.pltc.me/$GITHUB_REPOSITORY-web:$GITHUB_SHA
```

Then it SSHes to the VM, uploads `docker-compose.prod.yml` and `garage.toml`,
pulls those image tags, and runs:

```sh
docker compose -f docker-compose.prod.yml -p ameo-pm up -d --remove-orphans
```
