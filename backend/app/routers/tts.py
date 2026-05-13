"""
TTS Router — Fallback Text-to-Speech generation.
If the Android device's native TTS fails (common for Hindi/Tamil),
this endpoint generates an .mp3 using gTTS and returns it.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gtts import gTTS
import tempfile
import os

router = APIRouter(prefix="/api", tags=["TTS"])

class TTSRequest(BaseModel):
    text: str
    language: str

@router.post("/tts")
async def generate_tts(request: TTSRequest):
    try:
        # Map our internal language codes to gTTS language codes
        lang_map = {
            "en": "en",
            "hi": "hi",
            "ta": "ta",
            "te": "te",
            "bn": "bn",
            "kn": "kn"
        }
        gtts_lang = lang_map.get(request.language, "en")

        tts = gTTS(text=request.text, lang=gtts_lang, slow=False)
        
        # Create a temporary file to store the mp3
        fd, path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        tts.save(path)
        
        # Return the file, it will be deleted after being sent because we can't easily clean it up here,
        # but in a production app we'd use a background task to delete it.
        # For this hackathon, we'll let the OS clean up temp files eventually, or we could stream it.
        return FileResponse(path, media_type="audio/mpeg", filename="speech.mp3")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tts_get")
async def generate_tts_get(text: str, language: str = "en"):
    """GET version of TTS for easier integration with React Native Audio component."""
    try:
        lang_map = {
            "en": "en",
            "hi": "hi",
            "ta": "ta",
            "te": "te",
            "bn": "bn",
            "kn": "kn"
        }
        gtts_lang = lang_map.get(language, "en")

        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        
        fd, path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        tts.save(path)
        
        return FileResponse(path, media_type="audio/mpeg", filename="speech.mp3")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
