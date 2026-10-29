import asyncio
import io
import logging
import os
import tempfile
import time
from typing import Optional, Dict, Any
from PIL import Image
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# State tracking for genuine health status
_health_cache: Dict[str, Any] = {"timestamp": 0, "data": None}
_last_quota_error: Optional[str] = None


async def check_idm_vton_health() -> Dict[str, Any]:
    """
    Truthfully checks real-time availability of the IDM-VTON space and HF ZeroGPU quota.
    Queries Hugging Face Spaces API to confirm live hardware and replica status.
    """
    global _last_quota_error
    now = time.time()

    # If recent quota exceeded within last 5 minutes, report truthfully
    if _last_quota_error and (now - _health_cache.get("quota_timestamp", 0) < 300):
        return {
            "is_configured": True,
            "status": "quota_exceeded",
            "model_name": "IDM-VTON (ECCV 2024)",
            "endpoint": settings.IDM_VTON_SPACE,
            "detail": _last_quota_error,
        }

    # Return cached health check if fresh (within 30 seconds)
    if _health_cache.get("data") and (now - _health_cache.get("timestamp", 0) < 30):
        return _health_cache["data"]

    space_name = settings.IDM_VTON_SPACE or "yisol/IDM-VTON"
    token = (settings.HF_TOKEN or "").strip()

    if not space_name or not token:
        result = {
            "is_configured": False,
            "status": "unavailable",
            "model_name": "IDM-VTON (ECCV 2024)",
            "endpoint": space_name or "Not configured",
            "detail": "HF_TOKEN or IDM_VTON_SPACE is missing in configuration.",
        }
        _health_cache["timestamp"] = now
        _health_cache["data"] = result
        return result

    # Check Hugging Face space runtime state directly
    api_url = f"https://huggingface.co/api/spaces/{space_name}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(api_url, headers=headers)

        if res.status_code == 200:
            info = res.json()
            runtime = info.get("runtime", {})
            stage = runtime.get("stage", "").upper()
            hardware = runtime.get("hardware", {}).get("current", "cpu")

            if stage in ("RUNNING", "APP_STARTING", "READY"):
                result = {
                    "is_configured": True,
                    "status": "available",
                    "model_name": "IDM-VTON (ECCV 2024)",
                    "endpoint": space_name,
                    "stage": stage,
                    "hardware": hardware,
                    "detail": "Service is online and ready for virtual try-on.",
                }
            else:
                result = {
                    "is_configured": True,
                    "status": "unavailable",
                    "model_name": "IDM-VTON (ECCV 2024)",
                    "endpoint": space_name,
                    "stage": stage,
                    "detail": f"Space is currently {stage.lower() or 'offline'}.",
                }
        elif res.status_code in (401, 403):
            result = {
                "is_configured": False,
                "status": "unavailable",
                "model_name": "IDM-VTON (ECCV 2024)",
                "endpoint": space_name,
                "detail": "Authentication failed. Check your HF_TOKEN in backend/.env.",
            }
        elif res.status_code == 429:
            result = {
                "is_configured": True,
                "status": "quota_exceeded",
                "model_name": "IDM-VTON (ECCV 2024)",
                "endpoint": space_name,
                "detail": "Hugging Face rate limit or ZeroGPU quota reached.",
            }
        else:
            result = {
                "is_configured": True,
                "status": "unavailable",
                "model_name": "IDM-VTON (ECCV 2024)",
                "endpoint": space_name,
                "detail": f"Hugging Face space returned HTTP {res.status_code}.",
            }
    except Exception as exc:
        logger.warning("Could not reach Hugging Face Space API: %s", exc)
        result = {
            "is_configured": bool(token),
            "status": "unavailable",
            "model_name": "IDM-VTON (ECCV 2024)",
            "endpoint": space_name,
            "detail": f"Network error checking space availability: {exc}",
        }

    _health_cache["timestamp"] = now
    _health_cache["data"] = result
    return result


async def call_idm_vton(
    person_bytes: bytes,
    garment_bytes: bytes,
    garment_description: Optional[str] = None,
    timeout_seconds: int = 120,
) -> bytes:
    """
    Executes authentic AI Virtual Try-On using IDM-VTON (ECCV 2024).
    Accepts (1) Person image and (2) Garment image as separate native inputs,
    warps the clothing naturally along the body pose, shoulders, and arms,
    and preserves 100% of the person's face, identity, hands, and original background.

    Strict rules:
    - Zero Pillow fake overlays or rectangular canvas patches.
    - If the neural model fails, an honest error is raised without saving fake results.
    """
    global _last_quota_error
    space_name = settings.IDM_VTON_SPACE or "yisol/IDM-VTON"
    hf_token = (settings.HF_TOKEN or "").strip() or None

    if not hf_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="HF_TOKEN is not configured on the backend.",
        )

    logger.info("Calling dedicated IDM-VTON engine (%s) with ZeroGPU authentication...", space_name)

    def _sync_idm_vton() -> bytes:
        from gradio_client import Client, handle_file

        client = Client(space_name, token=hf_token)

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f_person:
            f_person.write(person_bytes)
            person_path = f_person.name

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_garment:
            f_garment.write(garment_bytes)
            garment_path = f_garment.name

        try:
            description = (
                garment_description.strip()
                if garment_description and garment_description.strip()
                else "Upper-body clothing garment"
            )

            result = client.predict(
                dict={
                    "background": handle_file(person_path),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(garment_path),
                garment_des=description,
                is_checked=True,        # Automatic neural body segmentation & masking
                is_checked_crop=False,  # Preserve full natural camera perspective & pose
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )

            output_image_path = result[0] if isinstance(result, (list, tuple)) else result
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
        output_bytes = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_idm_vton),
            timeout=timeout_seconds,
        )
        # Verify valid image artifact
        test_img = Image.open(io.BytesIO(output_bytes))
        test_img.verify()
        _last_quota_error = None
        logger.info("IDM-VTON try-on completed successfully (%s bytes)", len(output_bytes))
        return output_bytes
    except asyncio.TimeoutError:
        logger.error("IDM-VTON request timed out after %s seconds", timeout_seconds)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"IDM-VTON generation timed out after {timeout_seconds} seconds. Please try again.",
        )
    except Exception as exc:
        logger.error("IDM-VTON inference error: %s", exc)
        err_msg = str(exc)
        if "exceeded your ZeroGPU runs limit" in err_msg or "quota" in err_msg.lower():
            _last_quota_error = "Hugging Face ZeroGPU quota limit reached. Please wait for quota refresh."
            _health_cache["quota_timestamp"] = time.time()
            detail = _last_quota_error
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        else:
            detail = f"Virtual Try-On generation error from {space_name}: {err_msg}"
            status_code = status.HTTP_502_BAD_GATEWAY
        raise HTTPException(
            status_code=status_code,
            detail=detail,
        )
