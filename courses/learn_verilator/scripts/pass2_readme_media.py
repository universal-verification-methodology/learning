#!/usr/bin/env python3
"""Update module README Media sections (stub → full media table)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

MEDIA_BLOCK = """## Media

| Artifact | Path |
|----------|------|
| Transcript | [transcript.md](transcript.md) |
| Outline | [outline.yaml](outline.yaml) |
| Slides | [slides.pptx](slides.pptx) · [slides.pdf](slides.pdf) |
| Video | [video.mp4](video.mp4) |
| Quiz | [quiz.json](quiz.json) |
"""

OLD_MEDIA = re.compile(
    r"## Media(?: \(module-slides ready\)| \(planned\))?\s*\n"
    r"(?:\s*\n)?"
    r"(?:\| Artifact \| Path \|\s*\n"
    r"\|[-| ]+\|\s*\n"
    r"(?:\|[^\n]+\|\s*\n)+)?",
    re.MULTILINE,
)


def main() -> None:
    course = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    updated = 0
    for readme in sorted(course.glob("module*/README.md")):
        text = readme.read_text(encoding="utf-8")
        original = text
        if "## Media" in text:
            text, n = OLD_MEDIA.subn(MEDIA_BLOCK + "\n", text, count=1)
            if n == 0:
                print(f"warn: no regex match {readme.parent.name}")
        elif "## Checklist" in text:
            text = text.replace("## Checklist", MEDIA_BLOCK + "\n## Checklist", 1)
        else:
            text = text.rstrip() + "\n\n" + MEDIA_BLOCK + "\n"
        if text != original:
            readme.write_text(text, encoding="utf-8")
            print(f"OK: {readme.parent.name}")
            updated += 1
        else:
            print(f"skip: {readme.parent.name}")
    print(f"Updated {updated} README(s) in {course.name}")


if __name__ == "__main__":
    main()
