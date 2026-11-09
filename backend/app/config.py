from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://shoplist:shoplist@localhost:5432/shoplist"
    # Wymagane i min. 32 znaki (HS256). Generowanie: openssl rand -hex 32
    jwt_secret: str = Field(min_length=32)
    jwt_ttl_days: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
