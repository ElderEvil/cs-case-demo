"""Runtime configuration from environment."""

from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Demo settings. Demo seed is insecure by design — rotation per deploy."""

    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(env_file=".env", env_prefix="CSDEMO_")

    demo_server_seed: str = "demo-seed-change-me"
    debug: bool = False
    database_url: str = "sqlite:///./cs-case-demo.db"


def get_settings() -> Settings:
    """Load settings from environment."""
    return Settings()
