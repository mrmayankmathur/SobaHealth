"""
Ollama Service — The AI brain of Aivaan.
Handles all communication with the locally running Ollama instance.
Supports text chat, vision (multimodal), and streaming responses.
"""
from __future__ import annotations
import httpx
import base64
import json
from typing import AsyncGenerator, Optional
from app.config import get_settings

settings = get_settings()


class OllamaService:
    """
    Service layer for interacting with Ollama's local API.
    All inference happens on-device — zero cloud calls.
    """

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str = "",
        temperature: float = 0.7,
    ) -> str:
        """
        Send a chat completion request to Ollama.
        Returns the full response text (non-streaming).
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if system_prompt:
            payload["messages"] = [
                {"role": "system", "content": system_prompt}
            ] + payload["messages"]

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]

    async def chat_stream(
        self,
        messages: list[dict],
        system_prompt: str = "",
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response from Ollama token-by-token.
        Yields individual text chunks for real-time display.
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
            },
        }
        if system_prompt:
            payload["messages"] = [
                {"role": "system", "content": system_prompt}
            ] + payload["messages"]

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                        if data.get("done", False):
                            break

    async def vision(
        self,
        prompt: str,
        image_bytes: bytes,
        system_prompt: str = "",
        temperature: float = 0.3,
    ) -> str:
        """
        Send an image + prompt to Ollama for multimodal inference.
        Used for: medical document extraction, food analysis, etc.
        Lower temperature for more factual extraction.
        """
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [image_b64],
                }
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        if system_prompt:
            payload["messages"] = [
                {"role": "system", "content": system_prompt}
            ] + payload["messages"]

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"]

    async def health_check(self) -> bool:
        """Check if Ollama is running and the model is loaded."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    return any(
                        self.model in m.get("name", "")
                        for m in models
                    )
            return False
        except Exception:
            return False


# Singleton instance
ollama_service = OllamaService()
