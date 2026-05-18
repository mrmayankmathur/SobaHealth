"""
SobaHealth Edge Server Configuration
All settings for the local FastAPI server that bridges the mobile app to Ollama.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """
    Configuration for the SobaHealth edge server.
    All values are designed for fully offline operation.
    """

    # --- Server ---
    APP_NAME: str = "SobaHealth Edge Server"
    APP_VERSION: str = "1.0.0"
    HOST: str = "0.0.0.0"  # Listen on all interfaces so phone can reach us
    PORT: int = 8000
    DEBUG: bool = True

    # --- Ollama (Local AI) ---
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    # Primary model: SobaHealth's clinical fine-tune (see training/README.md).
    # If it is not installed locally, the ollama_service falls back to
    # OLLAMA_FALLBACK_MODEL automatically on the first request.
    OLLAMA_MODEL: str = "sobahealth-clinical"
    OLLAMA_FALLBACK_MODEL: str = "gemma4:e2b"
    OLLAMA_TIMEOUT: int = 120  # seconds — generous for CPU inference

    # --- Whisper (Local STT) ---
    WHISPER_MODEL_SIZE: str = "small"  # Options: tiny, base, small, medium
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"  # Fastest on CPU

    # --- Database (Local SQLite) ---
    DATABASE_URL: str = "sqlite:///./sobahealth.db"

    # --- Supported Languages ---
    SUPPORTED_LANGUAGES: List[str] = ["en", "hi", "ta", "te", "bn", "kn"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
