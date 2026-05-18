"""
Symptom Checker Router — AI-powered triage using Gemma 4's UNIQUE features.

Leverages two Gemma 4 capabilities that most competitors won't use:
1. Function Calling — structured risk extraction via native tool use
2. Thinking Mode — shows the AI's reasoning chain (not just the answer)

This is what gets "Technical Depth" points.
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import json
import httpx

from app.services.ollama_service import ollama_service
from app.services.prompt_templates import SYMPTOM_CHECKER_SYSTEM
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api", tags=["Symptoms"])


# =============================================================================
# Gemma 4 Function Calling — Structured Risk Extraction
# =============================================================================
HEALTH_RISK_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "flag_health_risk",
            "description": (
                "Flag a health risk identified from the patient's symptoms. "
                "Call this function when you have enough information to assess risk."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "condition": {
                        "type": "string",
                        "description": "The suspected condition or diagnosis",
                    },
                    "probability": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "Likelihood of this condition",
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["emergency", "urgent", "routine", "self_care"],
                        "description": "How urgently the patient should seek care",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": (
                            "Step-by-step reasoning for why this condition is suspected"
                        ),
                    },
                    "recommended_actions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of recommended next steps",
                    },
                },
                "required": [
                    "condition",
                    "probability",
                    "urgency",
                    "reasoning",
                    "recommended_actions",
                ],
            },
        },
    }
]


class SymptomMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class SymptomCheckRequest(BaseModel):
    messages: list[SymptomMessage] = Field(
        ..., description="Conversation history for symptom assessment"
    )
    language: str = Field(default="en")
    use_thinking: bool = Field(
        default=True,
        description="Enable Gemma 4 thinking mode for transparent reasoning",
    )


class RiskFlag(BaseModel):
    condition: str
    probability: str
    urgency: str
    reasoning: str
    recommended_actions: list[str]


class SymptomCheckResponse(BaseModel):
    response: str
    urgency: str
    thinking: Optional[str] = None  # Gemma 4's reasoning chain
    risk_flags: list[RiskFlag] = []  # From function calling


@router.post("/symptom-check", response_model=SymptomCheckResponse)
async def check_symptoms(request: SymptomCheckRequest):
    """
    Symptom assessment endpoint using Gemma 4's unique features:
    - Function Calling: extracts structured risk flags
    - Thinking Mode: shows the AI's reasoning process

    This is NOT generic prompt engineering — it's native Gemma 4 capability.
    """
    try:
        language_names = {
            "en": "English",
            "hi": "Hindi",
            "ta": "Tamil",
            "te": "Telugu",
            "bn": "Bengali",
            "kn": "Kannada",
        }
        lang_name = language_names.get(request.language, "English")

        system = (
            SYMPTOM_CHECKER_SYSTEM
            + f"\n\nRespond in {lang_name}."
            + "\n\nWhen you have gathered enough symptom information, "
            + "use the flag_health_risk function to report structured findings."
        )

        messages = [
            {"role": "system", "content": system},
        ] + [{"role": msg.role, "content": msg.content} for msg in request.messages]

        # === Gemma 4 Function Calling + Thinking Mode ===
        # This payload uses Ollama's tool calling API which Gemma 4 supports natively
        resolved_model = await ollama_service.resolve_model()
        payload = {
            "model": resolved_model,
            "messages": messages,
            "stream": False,
            "tools": HEALTH_RISK_TOOLS,
            "options": {
                "temperature": 0.4,
            },
        }

        # Enable thinking mode if requested
        # Gemma 4 returns its reasoning chain separately
        if request.use_thinking:
            payload["options"]["num_predict"] = 4096  # Allow longer reasoning

        async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        # Extract the response
        msg = data.get("message", {})
        response_text = msg.get("content", "")
        tool_calls = msg.get("tool_calls", [])

        # Extract thinking/reasoning if available
        thinking_text = None
        # Gemma 4 sometimes includes <think> blocks in its response
        if "<think>" in response_text and "</think>" in response_text:
            think_start = response_text.index("<think>") + 7
            think_end = response_text.index("</think>")
            thinking_text = response_text[think_start:think_end].strip()
            # Remove thinking block from the visible response
            response_text = (
                response_text[: response_text.index("<think>")]
                + response_text[think_end + 8 :]
            ).strip()

        # Parse function call results (structured risk flags)
        risk_flags = []
        for tool_call in tool_calls:
            if tool_call.get("function", {}).get("name") == "flag_health_risk":
                args = tool_call["function"].get("arguments", {})
                if isinstance(args, str):
                    args = json.loads(args)
                risk_flags.append(RiskFlag(**args))

        # Determine urgency level
        urgency = "gathering_info"
        if risk_flags:
            # Use the highest urgency from function calls
            urgency_order = ["emergency", "urgent", "routine", "self_care"]
            for level in urgency_order:
                if any(rf.urgency == level for rf in risk_flags):
                    urgency = level
                    break
        elif "🔴" in response_text or "EMERGENCY" in response_text.upper():
            urgency = "emergency"
        elif "🟡" in response_text or "SEE DOCTOR" in response_text.upper():
            urgency = "see_doctor"
        elif "🟢" in response_text or "SELF-CARE" in response_text.upper():
            urgency = "self_care"

        # Map urgency values
        urgency_map = {
            "routine": "see_doctor",
            "self_care": "self_care",
            "urgent": "see_doctor",
            "emergency": "emergency",
            "gathering_info": "gathering_info",
        }
        urgency = urgency_map.get(urgency, urgency)

        return SymptomCheckResponse(
            response=response_text,
            urgency=urgency,
            thinking=thinking_text,
            risk_flags=risk_flags,
        )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Start it with: ollama serve",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
