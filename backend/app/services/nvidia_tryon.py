import asyncio
import base64
import io
import logging
import os
import tempfile
from typing import Optional, Tuple
from PIL import Image, ImageOps
import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.ai_segmentation import remove_image_background

logger = logging.getLogger(__name__)

DEFAULT_TRYON_PROMPT = (
    "High-fashion realistic virtual try-on: Fit the clothing garment naturally on the person. "
    "Seamlessly integrate clothing drape, fabric texture, realistic wrinkles, seams, and natural shadows, "
    "while preserving the person's exact face, identity, skin tone, hair, and body pose."
)

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, distorted, bad anatomy, deformed hands, extra limbs, "
    "floating clothes, cartoon, 3d render, plastic look, oversaturated, watermark, "
    "rectangular borders, pasted box, frame"
)


def _image_to_data_uri(img: Image.Image, format: str = "JPEG", quality: int = 90) -> str:
    """Converts a PIL Image to a base64 data URI."""
    buffered = io.BytesIO()
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(buffered, format=format, quality=quality)
    encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
    mime = "image/jpeg" if format.upper() == "JPEG" else "image/png"
    return f"data:{mime};base64,{encoded}"


def create_tryon_composite(
    person_bytes: bytes,
    garment_bytes: bytes,
    target_height: int = 1024,
) -> Tuple[bytes, str]:
    """
    Creates a standardized dual-panel reference canvas for image-edit models:
    - Left panel: The person to be dressed.
    - Right panel: The reference garment on clean white canvas with aligned proportions.
    Returns composite image bytes and data URI.
    """
    try:
        person_img = Image.open(io.BytesIO(person_bytes))
        person_img = ImageOps.exif_transpose(person_img)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid person image file: {e}",
        )

    try:
        garment_img = Image.open(io.BytesIO(garment_bytes))
        garment_img = ImageOps.exif_transpose(garment_img)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid garment image file: {e}",
        )

    # Scale person to target height while maintaining aspect ratio
    p_w, p_h = person_img.size
    scale_p = target_height / max(p_h, 1)
    new_p_w = max(1, int(p_w * scale_p))
    new_p_h = target_height
    resized_person = person_img.resize((new_p_w, new_p_h), Image.Resampling.LANCZOS)
    if resized_person.mode != "RGB":
        resized_person = resized_person.convert("RGB")

    # Garment panel: clean square or proportional reference
    garment_panel_width = max(512, new_p_w // 2)
    garment_panel = Image.new("RGB", (garment_panel_width, target_height), (248, 248, 250))

    g_w, g_h = garment_img.size
    scale_g = min((garment_panel_width - 40) / max(g_w, 1), (target_height - 80) / max(g_h, 1))
    new_g_w = max(1, int(g_w * scale_g))
    new_g_h = max(1, int(g_h * scale_g))
    resized_garment = garment_img.resize((new_g_w, new_g_h), Image.Resampling.LANCZOS)

    # Paste garment centered in right panel
    pos_x = (garment_panel_width - new_g_w) // 2
    pos_y = (target_height - new_g_h) // 2
    if resized_garment.mode == "RGBA":
        garment_panel.paste(resized_garment, (pos_x, pos_y), resized_garment)
    else:
        garment_panel.paste(resized_garment, (pos_x, pos_y))

    # Combine side-by-side into single composite canvas
    total_width = new_p_w + garment_panel_width
    composite = Image.new("RGB", (total_width, target_height), (255, 255, 255))
    composite.paste(resized_person, (0, 0))
    composite.paste(garment_panel, (new_p_w, 0))

    buf = io.BytesIO()
    composite.save(buf, format="JPEG", quality=92)
    composite_bytes = buf.getvalue()
    data_uri = _image_to_data_uri(composite, format="JPEG", quality=92)

    return composite_bytes, data_uri


async def call_idm_vton(
    person_bytes: bytes,
    garment_bytes: bytes,
    garment_description: Optional[str] = None,
) -> bytes:
    """
    Executes true AI Virtual Try-On using IDM-VTON (ECCV 2024).
    Accepts (1) Person image and (2) Garment image as separate native inputs,
    warps the clothing naturally to fit the body pose, sleeves, and torso,
    and preserves 100% of the person's face, hair, and original background.
    """
    logger.info("Calling dedicated IDM-VTON model (%s)...", settings.IDM_VTON_SPACE)

    def _sync_idm_vton() -> bytes:
        from gradio_client import Client, handle_file

        client = Client(settings.IDM_VTON_SPACE)

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f_person:
            f_person.write(person_bytes)
            person_path = f_person.name

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_garment:
            f_garment.write(garment_bytes)
            garment_path = f_garment.name

        try:
            description = garment_description.strip() if garment_description and garment_description.strip() else "Clothing garment"
            result = client.predict(
                dict={
                    "background": handle_file(person_path),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(garment_path),
                garment_des=description,
                is_checked=True,        # Automatic body parsing & masking
                is_checked_crop=False,  # Preserve natural pose & framing
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )
            output_image_path, _ = result
            with open(output_image_path, "rb") as out_f:
                return out_f.read()
        finally:
            for p in (person_path, garment_path):
                if os.path.exists(p):
                    try:
                        os.unlink(p)
                    except Exception:
                        pass

    loop = asyncio.get_running_loop()
    try:
        output_bytes = await loop.run_in_executor(None, _sync_idm_vton)
        # Verify result with Pillow
        test_img = Image.open(io.BytesIO(output_bytes))
        test_img.verify()
        logger.info("IDM-VTON try-on completed successfully (size: %s)", len(output_bytes))
        return output_bytes
    except Exception as exc:
        logger.error("IDM-VTON inference error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Virtual Try-On generation error from {settings.IDM_VTON_SPACE}: {exc}",
        )


async def call_nvidia_qwen_image_edit(
    composite_data_uri: str,
    prompt: str,
    api_key: str,
    endpoint: Optional[str] = None,
    timeout_seconds: Optional[int] = None,
) -> bytes:
    """
    Calls NVIDIA NIM Qwen-Image-Edit API with formatted payload and returns decoded image bytes.
    """
    target_endpoint = endpoint or settings.NVIDIA_TRYON_ENDPOINT
    timeout = timeout_seconds or settings.NVIDIA_TRYON_TIMEOUT_SECONDS

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "prompt": prompt,
        "image": composite_data_uri,
        "negative_prompt": DEFAULT_NEGATIVE_PROMPT,
        "cfg_scale": 4.5,
        "steps": 30,
        "seed": 42,
    }

    logger.info("Sending virtual try-on request to NVIDIA NIM (%s)", target_endpoint)

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
            detail=f"Could not connect to NVIDIA NIM Virtual Try-On service: {exc}",
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
                "NVIDIA does not host a shared public cloud endpoint for this model."
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


def synthesize_virtual_tryon_image(
    person_bytes: bytes,
    garment_bytes: bytes,
    prompt: Optional[str] = None,
) -> bytes:
    """
    Fallback synthesis when no GPU inference endpoint is reachable.
    """
    person_img = Image.open(io.BytesIO(person_bytes))
    person_img = ImageOps.exif_transpose(person_img).convert("RGBA")

    try:
        cutout_bytes = remove_image_background(garment_bytes)
        garment_img = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")
    except Exception:
        garment_img = Image.open(io.BytesIO(garment_bytes)).convert("RGBA")

    p_w, p_h = person_img.size
    target_h = min(p_h, 1200)
    target_w = max(1, int(p_w * (target_h / max(p_h, 1))))
    resized_person = person_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    desired_garment_w = max(1, int(target_w * 0.58))
    g_w, g_h = garment_img.size
    aspect_g = g_h / max(g_w, 1)
    desired_garment_h = max(1, int(desired_garment_w * aspect_g))

    if desired_garment_h > int(target_h * 0.60):
        desired_garment_h = int(target_h * 0.60)
        desired_garment_w = max(1, int(desired_garment_h / aspect_g))

    resized_garment = garment_img.resize((desired_garment_w, desired_garment_h), Image.Resampling.LANCZOS)

    pos_x = (target_w - desired_garment_w) // 2
    pos_y = int(target_h * 0.22)

    shadow = Image.new("RGBA", (desired_garment_w, desired_garment_h), (0, 0, 0, 0))
    alpha = resized_garment.split()[3]
    soft_alpha = alpha.point(lambda p: int(p * 0.25))
    shadow.paste((30, 30, 35, 60), (0, 0), mask=soft_alpha)

    canvas = resized_person.copy()
    canvas.alpha_composite(shadow, (pos_x + 3, pos_y + 4))
    canvas.alpha_composite(resized_garment, (pos_x, pos_y))

    final_output = canvas.convert("RGB")
    buf = io.BytesIO()
    final_output.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


async def generate_virtual_tryon(
    person_bytes: bytes,
    garment_bytes: bytes,
    custom_prompt: Optional[str] = None,
) -> bytes:
    """
    End-to-end execution of AI Virtual Try-On.
    - Default provider: 'idm_vton' (ECCV 2024 dedicated neural try-on).
    - Alternative: 'nvidia_nim' (self-hosted Qwen-Image-Edit NIM).
    """
    provider = settings.TRYON_PROVIDER.lower().strip()

    if provider == "idm_vton":
        try:
            return await call_idm_vton(
                person_bytes=person_bytes,
                garment_bytes=garment_bytes,
                garment_description=custom_prompt,
            )
        except Exception as e:
            logger.warning("IDM-VTON call failed: %s. Falling back to local synthesis.", e)
            return synthesize_virtual_tryon_image(person_bytes, garment_bytes, custom_prompt)

    elif provider == "nvidia_nim":
        api_key = settings.NVIDIA_API_KEY
        if not api_key or not api_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="NVIDIA_API_KEY is not configured on the backend.",
            )

        _, composite_data_uri = create_tryon_composite(person_bytes, garment_bytes)
        effective_prompt = (
            f"Virtual Try-On: The person on the left must wear the clothing item shown on the right. "
            f"{custom_prompt.strip() if custom_prompt else DEFAULT_TRYON_PROMPT} "
            f"Remove the reference panel completely. Fit the garment naturally to the torso and arms."
        )

        try:
            return await call_nvidia_qwen_image_edit(
                composite_data_uri=composite_data_uri,
                prompt=effective_prompt,
                api_key=api_key,
            )
        except HTTPException as exc:
            if exc.status_code == 502 and "404" in exc.detail:
                logger.info("NVIDIA NIM 404, falling back to synthesis.")
                return synthesize_virtual_tryon_image(person_bytes, garment_bytes, custom_prompt)
            raise exc

    # Default fallback
    return synthesize_virtual_tryon_image(person_bytes, garment_bytes, custom_prompt)
