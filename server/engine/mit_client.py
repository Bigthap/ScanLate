import json
import httpx
import logging
from typing import List, Dict, Any
from server import config

logger = logging.getLogger("ScanLate-EngineClient")

class EngineClient:
    def __init__(self):
        self.url = f"{config.MIT_SERVER_URL}/translate/with-form/json"

    async def get_ocr_regions(self, image_bytes: bytes, source_lang: str, ocr_model: str = None) -> List[Dict[str, Any]]:
        """
        Sends an image to the manga-image-translator server to run OCR and text detection.
        Returns a list of text regions (bounding boxes, original text, colors, angles).
        """
        # Map source_lang (ja, ko, zh, en) to engine expected codes if needed
        # Standard ja -> ja, ko -> ko, en -> en, zh -> ch_tra or ch_sim (default zh)
        lang_map = {
            "ja": "JPN",
            "ko": "KOR",
            "zh": "CHS",
            "en": "ENG"
        }
        target_engine_lang = lang_map.get(source_lang.lower(), "JPN")

        # Set OCR model (default to 48px if not specified)
        ocr_model_name = ocr_model if ocr_model else "48px"

        engine_config = {
            "translator": {
                "translator": "none",
                "target_lang": target_engine_lang.upper(),
                "no_text_lang_skip": True
            },
            "inpainter": {
                "inpainter": "none"
            },
            "render": {
                "renderer": "none"
            },
            "ocr": {
                "ocr": ocr_model_name
            }
        }

        files = {
            "image": ("image.png", image_bytes, "image/png")
        }
        data = {
            "config": json.dumps(engine_config)
        }

        try:
            logger.info(f"Sending image to engine for OCR (Lang: {target_engine_lang}, OCR: {ocr_model_name})...")
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.url, files=files, data=data)
                
                if response.status_code != 200:
                    logger.error(f"Engine responded with error status {response.status_code}: {response.text}")
                    raise Exception(f"Engine error: {response.text}")

                result = response.json()
                logger.info("Successfully fetched OCR results from engine.")
                
                # Parse result
                regions = []
                translations = result.get("translations", [])
                
                for trans in translations:
                    # 'text' is a dictionary mapping language -> text content
                    text_dict = trans.get("text", {})
                    # Retrieve the original text (the key matches the source_lang or is the only element)
                    original_text = ""
                    if text_dict:
                        # Extract the first available language text or match target key
                        original_text = text_dict.get(list(text_dict.keys())[0], "")
                        for l_key, l_val in text_dict.items():
                            if l_key.lower().startswith(source_lang.lower()) or source_lang.lower().startswith(l_key.lower()):
                                original_text = l_val
                                break
                    
                    text_color = trans.get("text_color", {})
                    
                    regions.append({
                        "original_text": original_text.strip(),
                        "minX": trans.get("minX"),
                        "minY": trans.get("minY"),
                        "maxX": trans.get("maxX"),
                        "maxY": trans.get("maxY"),
                        "angle": trans.get("angle", 0),
                        "prob": trans.get("prob", 1.0),
                        "text_color": {
                            "fg": text_color.get("fg", [0, 0, 0]),
                            "bg": text_color.get("bg", [255, 255, 255])
                        }
                    })
                
                return regions
                
        except Exception as e:
            logger.error(f"Failed to communicate with OCR engine: {e}")
            raise e

_client = None

def get_engine_client() -> EngineClient:
    global _client
    if _client is None:
        _client = EngineClient()
    return _client
