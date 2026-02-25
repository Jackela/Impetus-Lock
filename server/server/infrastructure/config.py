"""Configuration management using pydantic-settings."""

from typing import Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://impetus:impetus_dev_password@localhost:5432/impetus_lock"

    # JWT
    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True

    # LLM
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    openai_temperature: Optional[float] = None
    anthropic_api_key: Optional[str] = None

    # Testing
    testing: Optional[str] = None

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="allow"  # Allow extra fields from .env
    )


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get or create settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
