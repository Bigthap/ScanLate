"""
RapidOCR client — PaddleOCR PP-OCRv4/v5 models via onnxruntime.
No PaddlePaddle framework needed. Runs on CPU → zero VRAM contention.

Install:
    pip install rapidocr-onnxruntime

Best for: Korean manhwa / English manhwa (oval bubbles, scene text)
"""
import asyncio
import logging
from typing import List, Dict, Any

import numpy as np
import cv2

logger = logging.getLogger("ScanLate-RapidOCR")

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _engine = RapidOCR()
            logger.info("RapidOCR engine initialized (ONNX/CPU mode).")
        except ImportError:
            raise RuntimeError(
                "rapidocr-onnxruntime is not installed. "
                "Run: pip install rapidocr-onnxruntime"
            )
    return _engine


def _decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes.")
    return img


def _parse_result(raw_result) -> List[Dict[str, Any]]:
    """Convert RapidOCR output → ScanLate region dicts."""
    regions = []
    if not raw_result:
        return regions

    for item in raw_result:
        # RapidOCR result format: [bbox, text, score]
        # bbox = [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        if not item or len(item) < 2:
            continue

        quad = item[0]
        text_field = item[1]
        score = float(item[2]) if len(item) > 2 else 1.0

        # Normalize text field (may be str or (str, float) tuple)
        if isinstance(text_field, (list, tuple)):
            text = str(text_field[0])
            if len(text_field) > 1:
                score = float(text_field[1])
        else:
            text = str(text_field)

        text = text.strip()
        if not text or score < 0.45:
            continue

        xs = [int(p[0]) for p in quad]
        ys = [int(p[1]) for p in quad]

        regions.append({
            "minX": min(xs),
            "minY": min(ys),
            "maxX": max(xs),
            "maxY": max(ys),
            "original_text": text,
            "fg_color": [0, 0, 0],
            "bg_color": [255, 255, 255],
            "alignment": "center",
            "font_size": 40,
        })

    return regions


def run_ocr_sync(image_bytes: bytes) -> List[Dict[str, Any]]:
    """Synchronous OCR — call via run_in_executor from async context."""
    engine = _get_engine()
    img = _decode_image(image_bytes)
    result, elapse = engine(img)
    regions = _parse_result(result)
    total_ms = sum(elapse) if isinstance(elapse, (list, tuple)) else elapse
    logger.info(f"RapidOCR: {len(regions)} regions detected in {total_ms:.3f}s")
    return regions


async def run_ocr(image_bytes: bytes) -> List[Dict[str, Any]]:
    """Async wrapper — offloads CPU-bound work to thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_ocr_sync, image_bytes)
