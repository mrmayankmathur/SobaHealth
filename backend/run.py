"""
SobaHealth Edge Server — Entry point
Run with: python run.py
"""
import uvicorn
from app.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    print(f"""
    ╔══════════════════════════════════════════════╗
    ║           🏥 SobaHealth Edge Server              ║
    ║      Offline AI Health Assistant              ║
    ╠══════════════════════════════════════════════╣
    ║  Server:  http://{settings.HOST}:{settings.PORT}            ║
    ║  Docs:    http://localhost:{settings.PORT}/docs       ║
    ║  Ollama:  {settings.OLLAMA_BASE_URL}           ║
    ║  Model:   {settings.OLLAMA_MODEL}                    ║
    ║                                              ║
    ║  🔒 All processing is 100% local             ║
    ╚══════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
