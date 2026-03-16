#!/usr/bin/env python3
"""Extract text from The Algorithm Design Manual PDF and find chapter boundaries."""

from pdfminer.high_level import extract_text
import os

PDF_PATH = "/Users/huangkai/workdir/lec/digital-garden/books/The Algorithm Design Manual (Steven S. Skiena) (Z-Library).pdf"
OUTPUT_DIR = "/Users/huangkai/workdir/lec/digital-garden/books/algorithm-design-extracted"

def extract_pages(start: int, end: int) -> str:
    """Extract text from pages start to end (0-indexed)."""
    return extract_text(PDF_PATH, page_numbers=list(range(start, end)))

def find_chapter_boundaries():
    """Scan PDF to find where each chapter starts."""
    # PDF page numbers are 0-indexed in pdfminer
    # Try different ranges to find "Chapter 1", "Chapter 2", etc.
    for start in [0, 1, 5, 10, 15, 20, 25, 30]:
        end = min(start + 5, 50)
        text = extract_pages(start, end)
        if "Chapter 1" in text or "CHAPTER 1" in text or "Introduction to Algorithm" in text:
            print(f"Chapter 1 likely starts around page {start + 1} (0-indexed: {start})")
            print("Sample:", text[:500])
            break
    else:
        print("Scanning pages 1-100 for chapter markers...")
        for p in range(1, 100, 10):
            text = extract_pages(p-1, min(p+9, 100))
            if "Chapter" in text:
                print(f"\n--- Pages {p}-{p+9} ---")
                # Show first 800 chars
                print(text[:800])
                print("...")

if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # First find chapter boundaries
    find_chapter_boundaries()
    
    # Extract chapters based on user's estimates (adjust after finding boundaries)
    # PDF pages: typically preface ends ~30, Ch1 ~31-70, Ch2 ~71-120, etc.
    chapters = [
        (1, 30, 70),   # Ch1: Introduction to Algorithm Design
        (2, 70, 120),  # Ch2: Algorithm Analysis  
        (3, 120, 180), # Ch3: Data Structures
        (4, 180, 230),# Ch4: Sorting
        (5, 230, 280), # Ch5: Divide and Conquer
        (6, 280, 330), # Ch6: Hashing and Randomized
    ]
    
    print("\n\n--- Extracting full chapter text ---")
    for ch_num, start, end in chapters:
        # pdfminer uses 0-based page numbers
        text = extract_pages(start - 1, end)
        out_path = os.path.join(OUTPUT_DIR, f"ch{ch_num:02d}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Chapter {ch_num}: pages {start}-{end} -> {out_path} ({len(text)} chars)")
