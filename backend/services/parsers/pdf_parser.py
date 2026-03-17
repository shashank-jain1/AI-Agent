"""
PDF text extractor — tries PyMuPDF first, falls back to Tesseract OCR for scanned PDFs.
"""
import unicodedata
import logging
import re
from typing import List, Dict, Tuple

import fitz  # PyMuPDF

from services.ocr import is_pdf_scanned, ocr_pdf_pages

logger = logging.getLogger(__name__)


def _clean_text(text: str) -> str:
    """Normalize unicode, collapse whitespace."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(file_path: str) -> Tuple[List[Dict], bool]:
    """
    Extract text from a PDF file.

    Returns:
        (pages, ocr_used) where pages = [{page_number, text}]
    """
    ocr_used = False

    # Step 1: Try native text extraction with PyMuPDF
    doc = fitz.open(file_path)
    pages: List[Dict] = []
    for page_num in range(len(doc)):
        text = doc[page_num].get_text("text")
        pages.append({"page_number": page_num + 1, "text": _clean_text(text)})
    doc.close()

    # Step 2: Check if text quality is poor (scanned PDF)
    if is_pdf_scanned(file_path):
        logger.info(f"PDF appears scanned — switching to OCR: {file_path}")
        ocr_used = True
        pages = ocr_pdf_pages(file_path)
        pages = [
            {"page_number": p["page_number"], "text": _clean_text(p["text"])}
            for p in pages
        ]
    else:
        logger.info(f"PDF text extraction OK (no OCR needed): {file_path}")

    # Filter out pages with no text
    pages = [p for p in pages if p["text"].strip()]
    return pages, ocr_used
