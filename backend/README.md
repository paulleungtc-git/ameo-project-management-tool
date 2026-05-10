# Ameo Backend

Minimal FastAPI backend scaffold for the Ameo project management tool.

## Local development

Install dependencies from `backend/`:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

Run the API:

```sh
uvicorn app.main:app --reload
```

Health check:

```sh
curl http://127.0.0.1:8000/health
```

## Environment

The app reads environment variables directly, with `.env` support:

```env
APP_NAME=Ameo Backend
ENVIRONMENT=local
DATABASE_URL=postgresql+psycopg://ameo:ameo@localhost:5432/ameo
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002
S3_ENDPOINT=http://localhost:3900
S3_BUCKET=attachments
S3_ACCESS_KEY=replace-with-garage-access-key-id
S3_SECRET_KEY=replace-with-garage-secret-access-key
S3_REGION=garage
S3_FORCE_PATH_STYLE=true
ATTACHMENT_MAX_BYTES=10485760
ATTACHMENT_ALLOWED_CONTENT_TYPES=image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,application/zip
```
