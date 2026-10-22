"""Environment-backed application configuration."""

from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings; secrets are supplied through environment variables."""

    app_env: Literal["development", "production"] = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "app_env"),
    )
    database_url: str = Field(
        validation_alias=AliasChoices("DATABASE_URL", "database_url")
    )
    jwt_secret_key: str = Field(
        min_length=32,
        validation_alias=AliasChoices(
            "APP_JWT_SECRET", "JWT_SECRET", "JWT_SECRET_KEY", "jwt_secret_key"
        ),
    )
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = Field(
        default=30,
        gt=0,
        validation_alias=AliasChoices("JWT_EXPIRATION", "ACCESS_TOKEN_MINUTES"),
    )
    cookie_secure: bool = Field(
        default=False,
        validation_alias=AliasChoices("APP_COOKIE_SECURE", "COOKIE_SECURE"),
    )
    cors_origins: str = Field(
        default="",
        validation_alias=AliasChoices("APP_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    allowed_hosts: str = "*"
    max_credits_per_period: int = Field(default=30, gt=0, le=60)
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @model_validator(mode="after")
    def validate_environment(self) -> "Settings":
        """Enforce production-safe cookie and CORS settings."""
        if self.app_env == "production":
            if not self.cookie_secure:
                raise ValueError("APP_COOKIE_SECURE must be true in production")
            if not self.cors_origins.strip():
                raise ValueError("APP_CORS_ORIGINS is required in production")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a normalized list."""
        configured = [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]
        if configured:
            return configured
        return ["http://localhost:3000", "http://localhost:5173"]

    @property
    def allowed_host_list(self) -> list[str]:
        """Return configured host names as a normalized list."""
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]


settings = Settings()
