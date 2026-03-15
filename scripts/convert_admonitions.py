"""Convert MkDocs admonitions to VitePress custom containers.

MkDocs:  !!! note "Title"            ??? tip "Title" (collapsible)
             Indented content            Indented content

VitePress: ::: info Title            ::: details Title
           Content                   Content
           :::                       :::
"""

import re
import sys
from pathlib import Path

TYPE_MAP = {
    "note": "info",
    "info": "info",
    "tip": "tip",
    "hint": "tip",
    "success": "tip",
    "check": "tip",
    "warning": "warning",
    "caution": "warning",
    "attention": "warning",
    "important": "warning",
    "danger": "danger",
    "error": "danger",
    "failure": "danger",
    "bug": "danger",
    "quote": "tip",
    "cite": "tip",
    "example": "details",
    "abstract": "info",
    "summary": "info",
    "tldr": "info",
    "question": "warning",
    "faq": "warning",
}

ADMONITION_RE = re.compile(
    r'^(?P<prefix>!!!\s|(\?\?\?\+?\s))(?P<type>\w+)\s*(?:"(?P<title>[^"]*)")?'
)


def convert_file(path: Path) -> bool:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    out: list[str] = []
    i = 0
    changed = False

    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip("\n")
        m = ADMONITION_RE.match(stripped)

        if m:
            changed = True
            prefix = m.group("prefix").strip()
            adm_type = m.group("type").lower()
            title = m.group("title") or ""
            is_collapsible = prefix.startswith("???")

            vp_type = "details" if is_collapsible else TYPE_MAP.get(adm_type, "info")
            header = f"::: {vp_type} {title}".rstrip() + "\n"
            out.append(header)
            i += 1

            while i < len(lines):
                content_line = lines[i]
                if content_line.strip() == "":
                    out.append("\n")
                    i += 1
                    continue

                if content_line.startswith("    "):
                    out.append(content_line[4:])
                    i += 1
                elif content_line.startswith("\t"):
                    out.append(content_line[1:])
                    i += 1
                else:
                    break

            out.append(":::\n\n")
        else:
            out.append(line)
            i += 1

    if changed:
        text = "".join(out)
        text = re.sub(r"\n{3,}", "\n\n", text)
        path.write_text(text, encoding="utf-8")

    return changed


def convert_math(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    new_text = text.replace(r"\(", "$").replace(r"\)", "$")
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    docs_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs")
    md_files = sorted(docs_dir.rglob("*.md"))
    print(f"Found {len(md_files)} markdown files")

    adm_count = 0
    math_count = 0
    for f in md_files:
        if convert_file(f):
            adm_count += 1
            print(f"  [admonition] {f}")
        if convert_math(f):
            math_count += 1
            print(f"  [math]       {f}")

    print(f"\nConverted admonitions in {adm_count} files, math in {math_count} files")


if __name__ == "__main__":
    main()
