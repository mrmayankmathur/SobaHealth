"""
Ollama Service — The AI brain of SobaHealth.
Handles all communication with the locally running Ollama instance.
Supports text chat, vision (multimodal), and streaming responses.
"""
from __future__ import annotations
import asyncio
import httpx
import base64
import json
import logging
from typing import AsyncGenerator, Optional
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class OllamaService:
    """
    Service layer for interacting with Ollama's local API.
    All inference happens on-device — zero cloud calls.

    Model resolution:
      Tries `settings.OLLAMA_MODEL` (the clinical fine-tune by default).
      If that tag isn't present locally, falls back to
      `settings.OLLAMA_FALLBACK_MODEL` (stock gemma4:e2b). The result is cached
      so we only hit `/api/tags` once per process.
    """

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.primary_model = settings.OLLAMA_MODEL
        self.fallback_model = settings.OLLAMA_FALLBACK_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT
        self._resolved_model: Optional[str] = None
        self._resolve_lock = asyncio.Lock()

    @property
    def model(self) -> str:
        """The model tag we last successfully resolved (primary or fallback)."""
        return self._resolved_model or self.primary_model

    async def _list_installed_tags(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
                return [m.get("name", "") for m in models]
        except Exception as exc:
            logger.warning("Could not list Ollama tags: %s", exc)
            return []

    async def resolve_model(self, force: bool = False) -> str:
        """
        Pick primary if installed, else fallback. Cached after first call.
        """
        if self._resolved_model and not force:
            return self._resolved_model
        async with self._resolve_lock:
            if self._resolved_model and not force:
                return self._resolved_model
            tags = await self._list_installed_tags()

            def has_tag(name: str) -> bool:
                return any(name == t or t.startswith(f"{name}:") for t in tags)

            if has_tag(self.primary_model):
                self._resolved_model = self.primary_model
            elif has_tag(self.fallback_model):
                logger.warning(
                    "Ollama model '%s' not found; falling back to '%s'",
                    self.primary_model, self.fallback_model,
                )
                self._resolved_model = self.fallback_model
            else:
                logger.warning(
                    "Neither '%s' nor '%s' installed in Ollama; using primary "
                    "tag anyway and letting Ollama report the error.",
                    self.primary_model, self.fallback_model,
                )
                self._resolved_model = self.primary_model
            return self._resolved_model

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
        model = await self.resolve_model()
        payload = {
            "model": model,
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
        model = await self.resolve_model()
        payload = {
            "model": model,
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
        model = await self.resolve_model()

        payload = {
            "model": model,
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
        """
        Healthy if Ollama is reachable and at least one of our candidate models
        (primary or fallback) is installed.
        """
        tags = await self._list_installed_tags()
        if not tags:
            return False

        def has_tag(name: str) -> bool:
            return any(name == t or t.startswith(f"{name}:") for t in tags)

        return has_tag(self.primary_model) or has_tag(self.fallback_model)


# Singleton instance
ollama_service = OllamaService()
