# Docker Compose

This scaffold starts the local infrastructure for the Ameo project management
tool:

- `postgres`: application database.
- `garage`: S3-compatible object storage for attachments.
- `backend`: expected FastAPI service from `./backend`.
- `web`: expected Next.js service from `./web`.

## Setup

```sh
cp .env.example .env
docker compose up -d garage
scripts/setup_garage_dev.sh
```

The Garage setup script assigns the single-node development layout, creates the
attachment bucket, imports deterministic development credentials, and grants the
backend key access to the bucket.

## Full Stack

```sh
docker compose up --build
```

Default local URLs:

- Web: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- Garage S3 API: `http://localhost:3900`
- Garage static web endpoint: `http://localhost:3902`
- Garage admin API: `http://localhost:3903`

## Notes

- `docs/garage.toml` is a development-only Garage configuration.
- The default Garage key in `.env.example` is development-only and should not be
  used for shared environments or production.
- Attachment bytes belong in Garage; attachment metadata belongs in Postgres.
- The backend should use path-style S3 requests with `S3_FORCE_PATH_STYLE=true`.
- Change all development credentials before shared or production use.
