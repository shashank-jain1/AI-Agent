"""
Tesseract OCR service for extracting text from scanned images and PDFs.

System dependencies required:
  Windows : Install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
            Add to PATH or set TESSERACT_CMD env var.
  Linux   : apt-get install tesseract-ocr tesseract-ocr-hin

NOTE: pdf2image / Poppler are NOT required. PDF pages are rendered via
      PyMuPDF (fitz) which is already installed and needs no native extras.
"""
import logging
import os
import re
from typing import List, Dict

import fitz  # PyMuPDF — used for both text extraction and page rendering
import pytesseract
from PIL import Image

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
    """Convert to grayscale, ensure minimum 300 DPI equivalent size."""
    img = img.convert("RGB")
    width, height = img.size
    # Upscale if image is too small (heuristic: < 1000px wide → double it)
    if width < 1000:
        img = img.resize((width * 2, height * 2), Image.LANCZOS)
    img = img.convert("L")  # Grayscale — improves OCR accuracy
    return img


def _clean_ocr_text(text: str) -> str:
    """Post-process OCR output: remove very short lines, normalize whitespace."""
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
    Render each PDF page to a 300-DPI image using PyMuPDF (no Poppler needed)
    and run Tesseract OCR on each page.
    Returns: [{page_number (1-indexed), text}]
    """
    logger.info(f"Running OCR on PDF via PyMuPDF renderer: {pdf_path}")
    results: List[Dict] = []

    doc = fitz.open(pdf_path)
    # 300 DPI → scale factor relative to PyMuPDF's 72-DPI default
    zoom = 300 / 72  # ≈ 4.167
    matrix = fitz.Matrix(zoom, zoom)

    for page_num in range(len(doc)):
        page = doc[page_num]
        # Render page to a pixmap (RGB, no alpha)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        # Convert raw pixmap bytes → PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = extract_text_from_pil_image(img)
        results.append({"page_number": page_num + 1, "text": text})
        logger.debug(f"  Page {page_num + 1}: {len(text)} chars extracted via OCR")

    doc.close()
    return results
