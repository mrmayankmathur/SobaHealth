"""
Voice Router — Offline Speech-to-Text endpoint.
Records audio from the mobile app → transcribes via faster-whisper.
100% offline — no audio data leaves the local network.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from app.services.whisper_service import transcribe_audio

router = APIRouter(prefix="/api", tags=["Voice"])


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    language: Optional[str] = Form(
        default=None,
        description="Language hint: 'hi', 'en', 'ta', etc."
    ),
):
    """
    Transcribe speech to text using faster-whisper.
    Runs entirely on-device — your voice never leaves this machine.
    """
    try:
        audio_bytes = await audio.read()

        if len(audio_bytes) == 0:
            raise HTTPException(
                status_code=400, detail="Empty audio file"
            )

        # Determine file extension from content type
        ext_map = {
            "audio/webm": ".webm",
            "audio/mp4": ".m4a",
            "audio/wav": ".wav",
            "audio/mpeg": ".mp3",
            "audio/x-m4a": ".m4a",
            "audio/mp4a-latm": ".m4a",
        }
        file_ext = ext_map.get(audio.content_type, ".webm")

        result = await transcribe_audio(
            audio_bytes=audio_bytes,
            language=language,
            file_extension=file_ext,
        )

        return {
            "transcript": result["transcript"],
            "detected_language": result["language"],
            "confidence": result["language_probability"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
