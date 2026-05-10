from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Ameo Backend"
    environment: str = "local"
    database_url: str = Field(
        default="postgresql+psycopg://ameo:ameo@localhost:5432/ameo",
        validation_alias="DATABASE_URL",
    )
    cors_origins: str = Field(
        default="http://localhost:3001,http://127.0.0.1:3001",
        validation_alias="CORS_ORIGINS",
    )
    s3_endpoint: str = Field(
        default="http://localhost:3900",
        validation_alias="S3_ENDPOINT",
    )
    s3_bucket: str = Field(default="attachments", validation_alias="S3_BUCKET")
    s3_access_key: str = Field(default="", validation_alias="S3_ACCESS_KEY")
    s3_secret_key: str = Field(default="", validation_alias="S3_SECRET_KEY")
    s3_region: str = Field(default="garage", validation_alias="S3_REGION")
    s3_force_path_style: bool = Field(
        default=True,
        validation_alias="S3_FORCE_PATH_STYLE",
    )
    attachment_max_bytes: int = Field(
        default=10 * 1024 * 1024,
        validation_alias="ATTACHMENT_MAX_BYTES",
    )
    attachment_allowed_content_types: str = Field(
        default="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,application/zip",
        validation_alias="ATTACHMENT_ALLOWED_CONTENT_TYPES",
    )
    auth_jwt_secret: str = Field(
        default="dev-secret-change-before-shared-use",
        validation_alias="AUTH_JWT_SECRET",
    )
    auth_access_token_minutes: int = Field(
        default=60 * 24,
        validation_alias="AUTH_ACCESS_TOKEN_MINUTES",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def attachment_allowed_content_type_list(self) -> list[str]:
        return [
            content_type.strip()
            for content_type in self.attachment_allowed_content_types.split(",")
            if content_type.strip()
        ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
