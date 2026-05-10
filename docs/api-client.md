# API Client Contract

The backend is the source of truth for the Ameo API contract. Export the
OpenAPI schema after backend route or schema changes:

```sh
backend/.venv/bin/python backend/scripts/export_openapi.py
```

The generated contract lives at `docs/openapi.json`.

Use this file as the input for generated clients:

- Web: keep hand-written calls small for now, then replace with a generated
  TypeScript client when the API stabilizes further.
- Mobile: generate the Flutter/Dart client from this contract before building
  the mobile app screens.

Do not hand-edit `docs/openapi.json`; update backend routes/schemas and rerun
the export script.
