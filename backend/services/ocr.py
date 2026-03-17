"""
Tesseract OCR service for extracting text from scanned images and PDFs.

System dependencies required:
  Windows : Install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
            Add to PATH or set pytesseract.pytesseract.tesseract_cmd
  Linux   : apt-get install tesseract-ocr tesseract-ocr-hin poppler-utils
"""
import io
import logging
import os
from typing import List, Dict

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

logger = logging.getLogger(__name__)

# --- Windows: point to Tesseract executable if needed ---
_tesseract_cmd = os.getenv("TESSERACT_CMD", "")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd

# Tesseract OCR config — PSM 6: assume a uniform block of text
_OCR_CONFIG = "--psm 6 --oem 3"
_OCR_LANG = "eng+hin"


def is_pdf_scanned(pdf_path: str) -> bool:
    """
    Returns True if the PDF appears to be a scanned (image-based) document.
    Samples the first 3 pages and checks average extractable text length.
    """
    try:
        doc = fitz.open(pdf_path)
        sample_pages = min(3, len(doc))
        total_chars = 0
        for i in range(sample_pages):
            text = doc[i].get_text("text")
            total_chars += len(text.strip())
        doc.close()
        avg_chars = total_chars / sample_pages if sample_pages > 0 else 0
        is_scanned = avg_chars < 50
        logger.info(
            f"PDF scan check: avg_chars={avg_chars:.1f} → {'SCANNED' if is_scanned else 'TEXT'}"
        )
        return is_scanned
    except Exception as e:
        logger.warning(f"Could not determine if PDF is scanned: {e}")
        return False


def _preprocess_image(img: Image.Image) -> Image.Image:
    """Convert to grayscale RGB, ensure minimum 300 DPI equivalent size."""
    img = img.convert("RGB")
    width, height = img.size
    # Upscale if image is too small (heuristic: < 1000px wide → double it)
    if width < 1000:
        img = img.resize((width * 2, height * 2), Image.LANCZOS)
    img = img.convert("L")  # Grayscale — improves OCR accuracy
    return img


def _clean_ocr_text(text: str) -> str:
    """Post-process OCR output: remove very short lines, normalize whitespace."""
    import re
    lines = text.splitlines()
    cleaned = [line for line in lines if len(line.strip()) >= 3]
    result = "\n".join(cleaned)
    result = re.sub(r"[ \t]+", " ", result)  # collapse horizontal whitespace
    return result.strip()


def extract_text_from_image(image_path: str) -> str:
    """
    Run Tesseract OCR on an image file.
    Supports Hindi + English (eng+hin).
    """
    try:
        with Image.open(image_path) as img:
            processed = _preprocess_image(img)
            raw_text = pytesseract.image_to_string(
                processed, lang=_OCR_LANG, config=_OCR_CONFIG
            )
        return _clean_ocr_text(raw_text)
    except Exception as e:
        logger.error(f"OCR failed for {image_path}: {e}")
        return ""


def extract_text_from_pil_image(img: Image.Image) -> str:
    """Run OCR on an in-memory PIL Image (used for PDF pages)."""
    try:
        processed = _preprocess_image(img)
        raw_text = pytesseract.image_to_string(
            processed, lang=_OCR_LANG, config=_OCR_CONFIG
        )
        return _clean_ocr_text(raw_text)
    except Exception as e:
        logger.error(f"OCR failed on PIL image: {e}")
        return ""


def ocr_pdf_pages(pdf_path: str) -> List[Dict]:
    """
    Convert each page of a PDF to a 300-DPI image and run OCR.
    Returns: [{page_number (1-indexed), text}]
    """
    logger.info(f"Running OCR on PDF: {pdf_path}")
    pages_images = convert_from_path(pdf_path, dpi=300)
    results: List[Dict] = []
    for idx, page_img in enumerate(pages_images, start=1):
        text = extract_text_from_pil_image(page_img)
        results.append({"page_number": idx, "text": text})
        logger.debug(f"  Page {idx}: {len(text)} chars extracted via OCR")
    return results
