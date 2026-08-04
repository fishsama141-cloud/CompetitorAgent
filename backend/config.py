"""Environment & configuration management via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- OpenAI / LLM ----
    openai_api_key: str = "sk-placeholder"
    openai_base_url: str = "https://api.openai.com/v1"

    # ---- ChromaDB ----
    chroma_persist_dir: str = "./chroma_db"

    # ---- Server ----
    host: str = "0.0.0.0"
    port: int = 8000

    # ---- Crawler ----
    crawl_timeout_seconds: int = 30


settings = Settings()
