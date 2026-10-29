import asyncio
import io
import logging
import os
import tempfile
from typing import Optional
from PIL import Image
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


async def call_idm_vton(
    person_bytes: bytes,
    garment_bytes: bytes,
    garment_description: Optional[str] = None,
    timeout_seconds: int = 90,
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
    space_name = settings.IDM_VTON_SPACE or "yisol/IDM-VTON"
    hf_token = (settings.HF_TOKEN or "").strip() or None

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
        if "exceeded your ZeroGPU runs limit" in err_msg:
            detail = (
                "Hugging Face ZeroGPU quota limit reached. Please verify that your HF_TOKEN in backend/.env "
                "is valid with active inference quota."
            )
        else:
            detail = f"Virtual Try-On generation error from {space_name}: {err_msg}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )
