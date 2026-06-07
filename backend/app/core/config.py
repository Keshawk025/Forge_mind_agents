import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "ForgeMind API"
    API_V1_STR: str = "/api/v1"
    
    # Databases
    DATABASE_URL: str = Field(default="postgresql+psycopg2://postgres:postgres@localhost:5432/forgemind")
    
    # Qdrant (Vector DB)
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_API_KEY: str = Field(default="")
    
    # Neo4j (Graph DB)
    NEO4J_URI: str = Field(default="bolt://localhost:7687")
    NEO4J_USERNAME: str = Field(default="neo4j")
    NEO4J_PASSWORD: str = Field(default="forgemind_password")
    
    # Auth
    JWT_SECRET: str = Field(default="super_secret_forgemind_jwt_key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Ollama
    OLLAMA_HOST: str = Field(default="http://localhost:11434")
    
    # Integrations
    GITHUB_TOKEN: str = Field(default="")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
