# Ameo Mobile

Flutter mobile client for the Ameo project management tool.

The mobile app talks to the FastAPI backend described by `../docs/openapi.json`.
This first scaffold keeps the client small and dependency-free while the API
continues to settle.

## Run

Start the backend first, then run:

```sh
flutter run --dart-define=AMEO_API_BASE_URL=http://127.0.0.1:8000
```

For an Android emulator, use the host bridge address:

```sh
flutter run --dart-define=AMEO_API_BASE_URL=http://10.0.2.2:8000
```

## Verify

```sh
flutter analyze
flutter test
```
