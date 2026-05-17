"""
Chat Router — AI Health Assistant endpoint.
Handles text-based conversations with Gemma 4 via Ollama.
Supports streaming and multi-language responses.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import json
import httpx

from app.services.ollama_service import ollama_service
from app.services.prompt_templates import HEALTH_ASSISTANT_SYSTEM

router = APIRouter(prefix="/api", tags=["Chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(
        ..., description="Conversation history"
    )
    language: str = Field(
        default="en",
        description="Response language: en, hi, ta, etc."
    )
    stream: bool = Field(
        default=False,
        description="Whether to stream the response"
    )


class ChatResponse(BaseModel):
    response: str
    language: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to SobaHealth's health assistant.
    All inference happens locally via Ollama — nothing leaves this machine.
    """
    try:
        # Build system prompt with language instruction
        language_names = {
            "en": "English", "hi": "Hindi", "ta": "Tamil",
            "te": "Telugu", "bn": "Bengali", "kn": "Kannada",
        }
        lang_name = language_names.get(request.language, "English")
        system = (
            HEALTH_ASSISTANT_SYSTEM
            + f"\n\nIMPORTANT: Respond in {lang_name}."
        )

        # Convert to Ollama message format
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]

        if request.stream:
            # Return streaming response
            async def stream_generator():
                async for chunk in ollama_service.chat_stream(
                    messages=messages,
                    system_prompt=system,
                ):
                    yield json.dumps({"chunk": chunk}) + "\n"

            return StreamingResponse(
                stream_generator(),
                media_type="application/x-ndjson",
            )

        # Non-streaming response
        response_text = await ollama_service.chat(
            messages=messages,
            system_prompt=system,
        )

        return ChatResponse(
            response=response_text,
            language=request.language,
        )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Start it with: ollama serve",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check if the edge server and Ollama are operational."""
    ollama_ok = await ollama_service.health_check()
    return {
        "server": "ok",
        "ollama": "connected" if ollama_ok else "disconnected",
        "model": ollama_service.model,
        "privacy": "all-local",
    }
