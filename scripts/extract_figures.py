"""Extract figures from the Unit Testing book PDF as PNG images."""
import fitz
import re
import os

PDF_PATH = "unit-testing-patterns/Unit Testing Principles, Practices, and Patterns (Vladimir Khorikov) (Z-Library).pdf"
OUTPUT_DIR = "unit-testing-patterns/docs/images"

CHAPTER_PAGES = {
    1: (25, 40),
    2: (42, 61),
    3: (63, 85),
    4: (89, 112),
    5: (114, 138),
    6: (141, 171),
    7: (173, 202),
    8: (207, 235),
    9: (238, 249),
    10: (251, 277),
    11: (281, 295),
}


def page_to_chapter(page_num: int) -> int | None:
    for ch, (start, end) in CHAPTER_PAGES.items():
        if start <= page_num <= end:
            return ch
    return None


def extract_figures(pdf_path: str, output_dir: str) -> None:
    doc = fitz.open(pdf_path)
    figure_pattern = re.compile(r"^Figure\s+(\d+)\.(\d+)\s", re.MULTILINE)

    os.makedirs(output_dir, exist_ok=True)
    for ch in range(1, 12):
        os.makedirs(os.path.join(output_dir, f"ch{ch:02d}"), exist_ok=True)

    extracted = set()

    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        text = page.get_text()
        page_num = page_idx + 1

        for match in figure_pattern.finditer(text):
            ch_num = int(match.group(1))
            fig_num = int(match.group(2))
            fig_id = f"{ch_num}.{fig_num}"

            if fig_id in extracted:
                continue
            extracted.add(fig_id)

            zoom = 3.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)

            out_path = os.path.join(
                output_dir, f"ch{ch_num:02d}", f"figure-{ch_num}-{fig_num}.png"
            )
            pix.save(out_path)
            size_kb = os.path.getsize(out_path) / 1024
            print(f"  [p.{page_num}] Figure {fig_id} -> {out_path} ({size_kb:.0f} KB)")

    doc.close()
    print(f"\nDone: extracted {len(extracted)} figures.")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    extract_figures(PDF_PATH, OUTPUT_DIR)
