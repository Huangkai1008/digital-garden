#!/usr/bin/env python3
"""Extract text from Computer Organization and Design RISC-V PDF to find chapter boundaries."""

from pdfminer.high_level import extract_text
import sys

PDF_PATH = "/Users/huangkai/workdir/lec/digital-garden/books/Computer Organization and Design RISC-V edition.pdf"

def extract_pages(start: int, end: int, output_file: str = None):
    """Extract text from specified page range. start/end are 1-based (human-readable)."""
    page_numbers = list(range(start - 1, end))  # pdfminer uses 0-based
    text = extract_text(PDF_PATH, page_numbers=page_numbers)
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Saved to {output_file} ({len(text)} chars)")
    return text

def find_chapters():
    """Sample pages to find chapter boundaries."""
    # Typical textbook: front matter ~60 pages, then Chapter 1
    # Let's sample every 20 pages from 1 to 200 to find "Chapter 1", "Chapter 2", "Chapter 3"
    for i in range(1, 250, 10):
        text = extract_pages(i, i + 2, None)
        if "Chapter 1" in text or "Chapter 2" in text or "Chapter 3" in text:
            print(f"\n--- Pages {i}-{i+2} ---")
            print(text[:800])
            print("...")

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        start, end = int(sys.argv[1]), int(sys.argv[2])
        out = sys.argv[3] if len(sys.argv) > 3 else None
        extract_pages(start, end, out)
    else:
        find_chapters()
