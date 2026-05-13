"""
Whisper Service — Offline Speech-to-Text.
Uses faster-whisper for completely local transcription.
No audio data ever leaves the device.
"""
import tempfile
import os
from typing import Optional
from app.config import get_settings

settings = get_settings()

# Lazy-loaded model to avoid slow startup
_whisper_model = None


def get_whisper_model():
    """Lazy-load the Whisper model on first use."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL_SIZE,
            device=settings.WHISPER_DEVICE,
            compute_type=settings.WHISPER_COMPUTE_TYPE,
        )
    return _whisper_model


async def transcribe_audio(
    audio_bytes: bytes,
    language: Optional[str] = None,
    file_extension: str = ".webm",
) -> dict:
    """
    Transcribe audio bytes to text using faster-whisper.
    Fully offline — no data leaves the machine.

    Args:
        audio_bytes: Raw audio file bytes
        language: Optional language hint (e.g., "hi" for Hindi)
        file_extension: Audio format extension

    Returns:
        dict with 'transcript', 'language', and 'confidence'
    """
    model = get_whisper_model()

    # Write audio to temp file (faster-whisper needs a file path)
    with tempfile.NamedTemporaryFile(
        suffix=file_extension, delete=False
    ) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language=language,
            vad_filter=True,  # Filter out silence
        )

        # Collect all segment texts
        transcript = " ".join(segment.text.strip() for segment in segments)

        return {
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)
