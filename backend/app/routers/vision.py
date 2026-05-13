"""
Vision Router — Medical document extraction & food analysis.
Uses Gemma 4's multimodal capabilities to analyze images.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import json

from app.services.ollama_service import ollama_service
from app.services.prompt_templates import (
    DOCUMENT_EXTRACTION_PROMPT,
    DOCUMENT_SUMMARY_PROMPT,
    NUTRITION_ANALYSIS_PROMPT,
)

router = APIRouter(prefix="/api", tags=["Vision"])


@router.post("/extract-document")
async def extract_document(
    image: UploadFile = File(..., description="Medical document image"),
    language: str = Form(default="en", description="Summary language"),
):
    """
    Extract structured data from a medical document image.
    Uses Gemma 4 vision — all processing is local.
    """
    try:
        image_bytes = await image.read()

        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=400, detail="Empty image file"
            )

        # Step 1: Extract structured data
        raw_extraction = await ollama_service.vision(
            prompt=DOCUMENT_EXTRACTION_PROMPT,
            image_bytes=image_bytes,
            temperature=0.2,  # Low temp for factual extraction
        )

        # Step 2: Try to parse as JSON
        extracted_data = None
        try:
            # Try to extract JSON from the response
            json_start = raw_extraction.find("{")
            json_end = raw_extraction.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                extracted_data = json.loads(
                    raw_extraction[json_start:json_end]
                )
        except json.JSONDecodeError:
            extracted_data = {"raw_text": raw_extraction}

        # Step 3: Generate plain-language summary
        language_names = {
            "en": "English", "hi": "Hindi", "ta": "Tamil",
            "te": "Telugu", "bn": "Bengali", "kn": "Kannada",
        }
        lang_name = language_names.get(language, "English")

        summary_prompt = DOCUMENT_SUMMARY_PROMPT.format(
            report_data=json.dumps(extracted_data, indent=2),
            language=lang_name,
        )
        summary = await ollama_service.chat(
            messages=[{"role": "user", "content": summary_prompt}],
            temperature=0.4,
        )

        return {
            "extracted_data": extracted_data,
            "summary": summary,
            "language": language,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-food")
async def analyze_food(
    image: UploadFile = File(..., description="Food image"),
):
    """
    Analyze food image for nutritional breakdown.
    Uses Gemma 4 vision for calorie and macro estimation.
    """
    try:
        image_bytes = await image.read()

        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=400, detail="Empty image file"
            )

        raw_result = await ollama_service.vision(
            prompt=NUTRITION_ANALYSIS_PROMPT,
            image_bytes=image_bytes,
            temperature=0.3,
        )

        # Try to parse JSON
        nutrition_data = None
        try:
            json_start = raw_result.find("{")
            json_end = raw_result.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                nutrition_data = json.loads(raw_result[json_start:json_end])
        except json.JSONDecodeError:
            nutrition_data = {"raw_analysis": raw_result}

        return {"nutrition": nutrition_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
