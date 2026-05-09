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
docker compose up -d postgres garage
```

Garage needs a one-time single-node layout before it can serve buckets:

```sh
docker compose exec garage /garage status
docker compose exec garage /garage layout assign -z dc1 -c 1 <node-id>
docker compose exec garage /garage layout apply --version <layout-version>
```

Create the attachment bucket and an app key:

```sh
docker compose exec garage /garage bucket create attachments
docker compose exec garage /garage key create ameo-app
docker compose exec garage /garage bucket allow --read --write --owner attachments --key ameo-app
```

Copy the generated key ID and secret into `.env` as `S3_ACCESS_KEY` and
`S3_SECRET_KEY`.

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
- Attachment bytes belong in Garage; attachment metadata belongs in Postgres.
- The backend should use path-style S3 requests with `S3_FORCE_PATH_STYLE=true`.
- Change all development credentials before shared or production use.
