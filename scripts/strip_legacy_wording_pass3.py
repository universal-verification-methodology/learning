#!/usr/bin/env python3
"""Final cleanup: demo probes, 'legacy materials' peeks, Path split footers."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

DEMO_BLOCK = re.compile(
    r"\nLEGACY=.*?fi\n",
    re.S,
)

SUBS = [
    (r"the legacy combined materials", "this module’s examples"),
    (r"the legacy materials", "this module’s examples"),
    (r"legacy combined materials", "this module’s examples"),
    (r"legacy materials", "this module’s examples"),
    (r"# legacy examples/verilator-uvm-hello not present", "# optional deeper RTL peek skipped"),
    (r"# legacy .* not present", "# optional peek skipped"),
    (r"legacy course", "course"),
    (
        r"Path split from \[`[^\]]+`\]\([^\)]+\)\. Platform tools and the parent monorepo may carry additional notices\.\n?",
        "",
    ),
    (
        r"Path split from \[`[^\]]+`\]\([^\)]+\)\.\n?",
        "",
    ),
]


def scrub_demo(text: str) -> str:
    text2, n = DEMO_BLOCK.subn(
        "\necho '# (module examples above are enough for Track A)'\n",
        text,
        count=1,
    )
    return text2 if n else text


def main() -> None:
    ids = [c["id"] for c in json.loads(CATALOG.read_text(encoding="utf-8"))["courses"]]
    n = 0
    for cid in ids:
        root = ROOT / "courses" / cid
        for path in root.rglob("*"):
            try:
                if not path.is_file():
                    continue
            except OSError:
                continue
            if path.suffix.lower() not in {".md", ".sh", ".txt", ".yaml", ".yml", ".json"}:
                continue
            if any(x in path.parts for x in ("obj_dir", "sim_build", "frames", "audio")):
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            orig = text
            if path.name.startswith("_demo_") and path.suffix == ".sh":
                text = scrub_demo(text)
            for pat, repl in SUBS:
                text = re.sub(pat, repl, text)
            if text != orig:
                path.write_text(text, encoding="utf-8", newline="\n")
                n += 1
                print("fix", path.relative_to(ROOT))
    print(f"fixed={n}")


if __name__ == "__main__":
    main()
