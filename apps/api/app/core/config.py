from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    environment: str = "development"
    secret_key: str = "change-me-in-production"

    # Database
    database_url: str
    database_url_sync: str

    # Auth (Clerk)
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""

    # Groq
    groq_api_key: str = ""

    # OpenAI (embeddings only — Groq doesn't provide embeddings)
    openai_api_key: str = ""

    # GitHub
    github_token: str = ""

    # Cognee
    cognee_db_path: str = "./data/cognee"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # don't crash on unknown env vars (e.g. from cognee/system)


@lru_cache
def get_settings() -> Settings:
    return Settings()
