from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- App -------------------------------------------
    APP_ENV: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # -- Database --------------------------------------
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/postgres"

    # -- Redis / Celery --------------------------------
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # -- Object Storage (RustFS / S3) ------------------
    RUSTFS_ENDPOINT: str = "http://rustfs:9000"
    RUSTFS_ACCESS_KEY: str = "rustfsadmin"
    RUSTFS_SECRET_KEY: str = "rustfsadmin"
    RUSTFS_BUCKET_DATASETS: str = "datasets"
    RUSTFS_BUCKET_STAGING: str = "uploads-staging"
    RUSTFS_BUCKET_EXPORTS: str = "exports"

    # -- CORS ------------------------------------------
    # Store as a plain comma-separated string so pydantic-settings v2
    # does not try to JSON-parse it as a List at the env-source level.
    # Use the cors_origins_list property wherever a list is needed.
    CORS_ORIGINS: str = (
        "http://localhost,http://app.localhost,"
        "http://localhost:3000,http://localhost:5173"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Keycloak OIDC ─────────────────────────────
    # For MVP dev: points to local Keycloak in docker-compose
    # For production with Kubeflow: just change these two vars to
    # point at Kubeflow's Keycloak (no code changes needed)
    KEYCLOAK_URL: str = "http://keycloak:8080"
    KEYCLOAK_EXTERNAL_URL: str = "http://localhost:8081"
    KEYCLOAK_REALM: str = "daggle"
    KEYCLOAK_CLIENT_ID: str = "daggle-backend"
    KEYCLOAK_CLIENT_SECRET: str = "change_me_keycloak_secret"
    KEYCLOAK_ADMIN: str = "admin"
    KEYCLOAK_ADMIN_PASSWORD: str = "admin"

    # Computed property — OIDC discovery / token endpoint base
    @property
    def keycloak_realm_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"

    @property
    def keycloak_external_realm_url(self) -> str:
        return f"{self.KEYCLOAK_EXTERNAL_URL}/realms/{self.KEYCLOAK_REALM}"

    @property
    def keycloak_token_url(self) -> str:
        return f"{self.keycloak_realm_url}/protocol/openid-connect/token"

    @property
    def keycloak_auth_url(self) -> str:
        return f"{self.keycloak_external_realm_url}/protocol/openid-connect/auth"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.keycloak_realm_url}/protocol/openid-connect/certs"

    @property
    def keycloak_logout_url(self) -> str:
        return f"{self.keycloak_external_realm_url}/protocol/openid-connect/logout"

    # ── Session (server-side HttpOnly cookie) ─────
    SESSION_SECRET_KEY: str = "change_me_super_secret_key_at_least_32_chars"
    SESSION_COOKIE_NAME: str = "daggle_session"
    SESSION_MAX_AGE: int = 60 * 60 * 8  # 8 hours


# Singleton — import this everywhere
settings = Settings()
