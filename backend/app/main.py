"""
SobaHealth Edge Server — FastAPI Application
The local AI brain that powers the SobaHealth mobile app.

Architecture:
  📱 Mobile App → (Local WiFi) → This Server → Ollama (Gemma 4)
  
Everything runs locally. Zero cloud. Zero internet required.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import chat, voice, vision, symptoms, discovery, tts

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "SobaHealth Edge Server — Offline AI health assistant. "
        "All inference runs locally via Ollama + Gemma 4. "
        "No data ever leaves this machine."
    ),
    docs_url="/docs" if settings.DEBUG else None,
)

# CORS — Allow mobile app connections from any local IP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Mobile app on same local network
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(vision.router)
app.include_router(symptoms.router)
app.include_router(discovery.router)
app.include_router(tts.router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "endpoints": {
            "chat": "/api/chat",
            "transcribe": "/api/transcribe",
            "extract_document": "/api/extract-document",
            "analyze_food": "/api/analyze-food",
            "symptom_check": "/api/symptom-check",
            "health": "/api/health",
            "docs": "/docs",
        },
        "privacy": "All processing is local. No data leaves this device.",
    }
