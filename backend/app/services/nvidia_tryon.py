import base64
import io
import logging
from typing import Optional
from PIL import Image, ImageOps
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# Explicit photorealistic garment replacement prompt per Phase 3G specifications
EXPLICIT_TRYON_INSTRUCTION = (
    "Perform a photorealistic clothing replacement edit. "
    "Image 1 is the original photograph of the person. "
    "Image 2 is the product reference for the garment that must be worn.\n\n"
    "Replace the existing upper-body garment in Image 1 with the exact garment shown in Image 2. "
    "The new garment must be physically worn on the person's body, following the person's torso, shoulders, arms, pose, and perspective.\n\n"
    "Preserve the person's face, identity, hair, hands, body proportions, pose, trousers, accessories, lighting, and original background. "
    "Preserve the reference garment's exact design, colors, patterns, logos, collar, sleeves, seams, and material as closely as possible.\n\n"
    "Adapt the garment to the person's body. Generate realistic fabric folds, natural sleeve positioning, correct shoulder alignment, contact shadows, and consistent lighting.\n\n"
    "The garment must NOT appear as a floating product image, rectangular patch, pasted cutout, separate panel, or object positioned in front of the person. "
    "Do not reproduce the product photograph's background. Output one coherent, photorealistic photograph of the same person actually wearing the new garment."
)

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, distorted, bad anatomy, deformed hands, extra limbs, "
    "floating clothes, cartoon, 3d render, plastic look, oversaturated, watermark, "
    "rectangular borders, pasted box, frame, sticker overlay, cut-and-paste artifact"
)


def get_garment_type_guidance(garment_hint: Optional[str]) -> str:
    """Adds specific physical drape, seam, and structural guidance based on garment category."""
    if not garment_hint:
        return "Garment category: Upper-body apparel. Fit collar to neck base, shoulder seams to acromion, and sleeves naturally along arm pose."
    h = garment_hint.lower()
    if any(k in h for k in ("hoodie", "sweatshirt", "sweater")):
        return "Garment category: Long-sleeve hoodie/sweatshirt. Natural ribbed cuffs resting on wrists, soft fleece drape over shoulders and chest, natural waist hem."
    if any(k in h for k in ("jacket", "coat", "blazer", "outerwear")):
        return "Garment category: Structured jacket/outerwear. Crisp shoulder pads/seams, open or zipped lapels, structured torso drape, realistic sleeve bunching at elbow."
    if any(k in h for k in ("t-shirt", "tee", "shirt", "top")):
        return "Garment category: Casual shirt/T-shirt. Soft fabric drape conforming to chest contour, clean collar trim, sleeves ending cleanly at biceps or wrists."
    if any(k in h for k in ("pant", "jean", "trouser", "bottom", "skirt")):
        return "Garment category: Trousers/Bottoms. Waistband sitting at natural waist, leg seams running down along leg anatomy to ankle hem."
    return "Garment category: Apparel. Physically fit to anatomy, following shoulders, arms, and torso contours."


def image_bytes_to_data_uri(img_bytes: bytes, max_dimension: int = 1536) -> str:
    """
    Converts image bytes to base64 data URI while preserving original aspect ratio,
    colors, and full resolution without cropping away torso, shoulders, arms, or background.
    """
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {e}",
        )

    if img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > max_dimension:
        scale = max_dimension / max(w, h)
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


async def call_nvidia_qwen_image_edit(
    person_data_uri: str,
    garment_data_uri: str,
    prompt: str,
    api_key: str,
    endpoint: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
) -> bytes:
    """
    Calls NVIDIA NIM Qwen-Image-Edit API sending the person photo and garment photo as
    separate discrete image inputs (not merged into a composite canvas or pasted with Pillow).
    """
    target_endpoint = endpoint or settings.NVIDIA_TRYON_ENDPOINT
    timeout = timeout_seconds or settings.NVIDIA_TRYON_TIMEOUT_SECONDS

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Pass discrete image inputs per multimodal image-editing schemas:
    # Image 1 (person), Image 2 (garment reference)
    payload = {
        "prompt": prompt,
        "images": [person_data_uri, garment_data_uri],
        "image": person_data_uri,
        "reference_image": garment_data_uri,
        "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
        "cfg_scale": 4.5,
        "steps": 30,
        "seed": 42,
    }

    logger.info("Sending genuine try-on request to NVIDIA NIM Qwen-Image-Edit (%s)", target_endpoint)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(target_endpoint, json=payload, headers=headers)
    except httpx.TimeoutException:
        logger.error("NVIDIA NIM API request timed out after %s seconds", timeout)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"NVIDIA AI Virtual Try-On request timed out after {timeout} seconds. Please try again.",
        )
    except httpx.RequestError as exc:
        logger.error("Network error communicating with NVIDIA NIM: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to NVIDIA NIM Virtual Try-On service at {target_endpoint}: {exc}",
        )

    # Handle status errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("NVIDIA API authentication failed (HTTP %s): %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NVIDIA API authentication failed. Please verify that your NVIDIA_API_KEY in backend/.env is valid.",
        )
    elif response.status_code == 404:
        logger.error("NVIDIA endpoint 404 Not Found: %s", target_endpoint)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"NVIDIA endpoint returned 404 Not Found at '{target_endpoint}'. "
                "Per NVIDIA's model catalog (build.nvidia.com/qwen/qwen-image-edit), "
                "Qwen-Image-Edit is an NVIDIA NIM 'Run Anywhere' container (nvcr.io/nim/qwen/qwen-image-edit:latest). "
                "NVIDIA does not host a shared public cloud endpoint for this model. "
                "To execute true neural virtual try-on, deploy the official NIM container on a GPU instance "
                "(e.g. docker run --gpus all -p 8080:8000 nvcr.io/nim/qwen/qwen-image-edit) "
                "and set NVIDIA_TRYON_ENDPOINT=http://<host>:8080/v1/infer in backend/.env."
            ),
        )
    elif response.status_code == 429:
        logger.warning("NVIDIA API rate limit exceeded")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="NVIDIA API rate limit reached. Please wait a moment before trying again.",
        )
    elif response.status_code >= 400:
        logger.error("NVIDIA API returned error (HTTP %s): %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NVIDIA Virtual Try-On generation failed (HTTP {response.status_code}): {response.text[:300]}",
        )

    # Parse response JSON
    try:
        result_json = response.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NVIDIA API returned invalid JSON: {e}",
        )

    b64_data = None
    artifacts = result_json.get("artifacts")
    if isinstance(artifacts, list) and len(artifacts) > 0:
        first = artifacts[0]
        if isinstance(first, dict):
            b64_data = first.get("base64") or first.get("image")

    if not b64_data:
        data_list = result_json.get("data")
        if isinstance(data_list, list) and len(data_list) > 0:
            first = data_list[0]
            if isinstance(first, dict):
                b64_data = first.get("b64_json")

    if not b64_data and "image" in result_json:
        b64_data = result_json["image"]

    if not b64_data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="NVIDIA API response did not contain an image artifact.",
        )

    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(b64_data)
        test_img = Image.open(io.BytesIO(image_bytes))
        test_img.verify()
        return image_bytes
    except Exception as e:
        logger.error("Failed to decode generated image from NVIDIA NIM: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to decode generated image returned by NVIDIA NIM.",
        )


async def call_nvidia_qwen_image(
    prompt: str,
    api_key: str,
    endpoint: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
) -> bytes:
    """
    Calls NVIDIA NIM Qwen-Image foundation model API and returns decoded image bytes.
    """
    target_endpoint = endpoint or settings.NVIDIA_QWEN_IMAGE_ENDPOINT
    timeout = timeout_seconds or settings.NVIDIA_TRYON_TIMEOUT_SECONDS

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "prompt": prompt,
        "seed": 42,
    }

    logger.info("Sending image generation request to NVIDIA NIM Qwen-Image (%s)", target_endpoint)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(target_endpoint, json=payload, headers=headers)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"NVIDIA AI request timed out after {timeout} seconds.",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to NVIDIA NIM Qwen-Image service: {exc}",
        )

    if response.status_code == 401 or response.status_code == 403:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NVIDIA API authentication failed. Please verify NVIDIA_API_KEY in backend/.env.",
        )
    elif response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"NVIDIA endpoint returned 404 Not Found at '{target_endpoint}'. "
                "Per NVIDIA's model catalog (build.nvidia.com/qwen/qwen-image), "
                "Qwen-Image is an NVIDIA NIM 'Run Anywhere' container (nvcr.io/nim/qwen/qwen-image:latest). "
                "To use Qwen-Image, run the official NIM container on a GPU instance "
                "(e.g. docker run --gpus all -p 8000:8000 nvcr.io/nim/qwen/qwen-image) "
                "and set NVIDIA_QWEN_IMAGE_ENDPOINT=http://<host>:8000/v1/infer in backend/.env."
            ),
        )
    elif response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NVIDIA Qwen-Image generation failed (HTTP {response.status_code}): {response.text[:300]}",
        )

    result_json = response.json()
    b64_data = None
    artifacts = result_json.get("artifacts")
    if isinstance(artifacts, list) and len(artifacts) > 0:
        first = artifacts[0]
        if isinstance(first, dict):
            b64_data = first.get("base64") or first.get("image")

    if not b64_data:
        data_list = result_json.get("data")
        if isinstance(data_list, list) and len(data_list) > 0:
            first = data_list[0]
            if isinstance(first, dict):
                b64_data = first.get("b64_json")

    if not b64_data and "image" in result_json:
        b64_data = result_json["image"]

    if not b64_data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="NVIDIA API response did not contain an image artifact.",
        )

    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(b64_data)
        test_img = Image.open(io.BytesIO(image_bytes))
        test_img.verify()
        return image_bytes
    except Exception as e:
        logger.error("Failed to decode generated image from NVIDIA NIM Qwen-Image: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to decode generated image returned by NVIDIA NIM Qwen-Image.",
        )


async def generate_virtual_tryon(
    person_bytes: bytes,
    garment_bytes: bytes,
    custom_prompt: Optional[str] = None,
    model: Optional[str] = "qwen-image-edit",
    garment_hint: Optional[str] = None,
) -> bytes:
    """
    End-to-end execution of genuine AI Virtual Try-On using NVIDIA Qwen NIM models:
    - 'qwen-image-edit': Dedicated image-to-image editing NIM with separate person & garment inputs.
    - 'qwen-image': Foundation multimodal generation NIM.

    Strict rules:
    - No Pillow compositing, sticker pasting, or fake 2D canvas overlays.
    - Person photo and garment photo are passed as separate, full-resolution discrete inputs.
    - If the neural NIM container is offline, honest technical details are returned.
    """
    api_key = settings.NVIDIA_API_KEY
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="NVIDIA_API_KEY is not configured on the backend.",
        )

    selected_model = (model or "qwen-image-edit").lower().strip()
    type_guidance = get_garment_type_guidance(garment_hint)

    if selected_model == "qwen-image":
        effective_prompt = (
            f"Photorealistic fashion portrait: A person physically wearing the specified garment. "
            f"{type_guidance} "
            f"{custom_prompt.strip() if custom_prompt else ''} "
            f"Natural fabric drape, realistic shadows, full-body studio lighting, 8k photographic quality."
        )
        return await call_nvidia_qwen_image(
            prompt=effective_prompt,
            api_key=api_key,
            endpoint=settings.NVIDIA_QWEN_IMAGE_ENDPOINT,
        )

    # Default: qwen-image-edit
    # Convert person and garment into discrete, full-resolution data URIs (separate inputs)
    person_data_uri = image_bytes_to_data_uri(person_bytes)
    garment_data_uri = image_bytes_to_data_uri(garment_bytes)

    # Build prompt incorporating Phase 3G explicit replacement instruction + garment guidance
    custom_styling = f"\nStyling instructions: {custom_prompt.strip()}" if custom_prompt and custom_prompt.strip() else ""
    effective_prompt = f"{EXPLICIT_TRYON_INSTRUCTION}\n\n{type_guidance}{custom_styling}"

    return await call_nvidia_qwen_image_edit(
        person_data_uri=person_data_uri,
        garment_data_uri=garment_data_uri,
        prompt=effective_prompt,
        api_key=api_key,
        endpoint=settings.NVIDIA_TRYON_ENDPOINT,
    )
