import base64
import io
import logging
from typing import Optional
from PIL import Image, ImageOps
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

GEMINI_TRYON_INSTRUCTION = (
    "You are an expert fashion photographer and AI virtual try-on engine.\n\n"
    "Input 1: The original photograph of the person.\n"
    "Input 2: The product reference photograph of the garment that must be worn.\n\n"
    "Task: Perform a photorealistic clothing replacement. "
    "Replace the person's existing upper-body clothing in Input 1 with the exact garment shown in Input 2.\n\n"
    "Requirements:\n"
    "1. The new garment must be physically fitted and worn on the person's body, following their torso, shoulders, arms, pose, and perspective.\n"
    "2. Preserve the person's exact face, identity, hair, hands, body proportions, pose, trousers, footwear, and original background.\n"
    "3. Preserve the reference garment's exact design, colors, graphics, typography, seams, collar, sleeves, and texture.\n"
    "4. Generate natural fabric drape, folds, sleeve positioning, and realistic contact shadows with lighting matching the scene.\n"
    "5. The garment must NOT look like a floating product cutout, sticker overlay, or separate image.\n"
    "6. Output the final edited photograph."
)


def _encode_image_part(image_bytes: bytes, max_dim: int = 1536) -> dict:
    """Encodes image bytes as a Gemini inlineData payload with preserved aspect ratio."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {e}",
        )

    if img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {
        "inlineData": {
            "mimeType": "image/jpeg",
            "data": b64_data,
        }
    }


async def call_gemini_image_edit(
    person_bytes: bytes,
    garment_bytes: bytes,
    custom_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    timeout_seconds: int = 90,
) -> bytes:
    """
    Executes AI Virtual Try-On using Google Gemini multimodal image generation API.
    Sends discrete, separate image inputs for the person and garment.
    """
    effective_key = (api_key or settings.GEMINI_API_KEY or "").strip()
    if not effective_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on the backend.",
        )

    effective_model = model_name or settings.GEMINI_IMAGE_MODEL or "gemini-2.5-flash-image"
    if not effective_model.startswith("gemini-"):
        effective_model = "gemini-2.5-flash-image"

    url = f"{GEMINI_API_BASE}/models/{effective_model}:generateContent?key={effective_key}"

    person_part = _encode_image_part(person_bytes)
    garment_part = _encode_image_part(garment_bytes)

    prompt_text = GEMINI_TRYON_INSTRUCTION
    if custom_prompt and custom_prompt.strip():
        prompt_text += f"\n\nAdditional fit and styling instructions: {custom_prompt.strip()}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    person_part,
                    garment_part,
                    {"text": prompt_text},
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "temperature": 0.4,
        },
    }

    logger.info("Calling Google Gemini Try-On (%s)...", effective_model)

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Google Gemini Virtual Try-On request timed out after {timeout_seconds} seconds.",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to Google Gemini API: {exc}",
        )

    if response.status_code == 429:
        err_msg = response.text
        logger.warning("Google Gemini API quota reached: %s", err_msg[:200])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Google Gemini image generation quota limit reached (limit: 0 on Google AI Studio Free Tier). "
                "Per Google documentation, image-capable Gemini models require linking a Google Cloud billing "
                "account to your project (projects/498528572086) to activate image generation quota."
            ),
        )
    elif response.status_code == 400:
        logger.error("Google Gemini 400 Bad Request: %s", response.text)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google Gemini request rejected: {response.text[:300]}",
        )
    elif response.status_code >= 400:
        logger.error("Google Gemini API error (HTTP %s): %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Gemini generation failed (HTTP {response.status_code}): {response.text[:300]}",
        )

    res_json = response.json()
    candidates = res_json.get("candidates", [])
    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google Gemini did not return any generation candidates.",
        )

    parts = candidates[0].get("content", {}).get("parts", [])
    image_b64 = None
    for part in parts:
        if "inlineData" in part:
            inline = part["inlineData"]
            if inline.get("mimeType", "").startswith("image/"):
                image_b64 = inline.get("data")
                break

    if not image_b64:
        # Check if text was returned explaining why image couldn't be generated
        text_content = "\n".join([p.get("text", "") for p in parts if "text" in p])
        logger.warning("Gemini returned text instead of image: %s", text_content[:200])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini returned text instead of an image: {text_content[:200]}",
        )

    try:
        image_bytes = base64.b64decode(image_b64)
        test_img = Image.open(io.BytesIO(image_bytes))
        test_img.verify()
        return image_bytes
    except Exception as e:
        logger.error("Failed to decode generated image from Gemini: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to decode generated image returned by Google Gemini.",
        )
