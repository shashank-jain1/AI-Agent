"""
Image text extractor — wraps the OCR service for standalone image files.
Supports PNG, JPG, JPEG, TIFF, WEBP, BMP.
"""
import logging
from typing import List, Dict

from services.ocr import extract_text_from_image

logger = logging.getLogger(__name__)


def extract_image_text(file_path: str) -> List[Dict]:
    """
    Run OCR on an image file.
    Returns: [{page_number: 1, text: ocr_result, is_ocr: True}]
    """
    logger.info(f"Running OCR on image: {file_path}")
    text = extract_text_from_image(file_path)
    logger.info(f"OCR extracted {len(text)} chars from image")
    return [{"page_number": 1, "text": text, "is_ocr": True}]
