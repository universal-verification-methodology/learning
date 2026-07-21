#!/usr/bin/env python3
"""Final pass: remove mangled 'legacy archive ignored' phrases."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ids = [c["id"] for c in json.loads((ROOT / "platform/assets/catalog.json").read_text(encoding="utf-8"))["courses"]]

SUBS = [
    (
        r" \(copied from the proven `learn_unix / learn_git \(legacy archive ignored\)` trees\)\.",
        ".",
    ),
    (
        r"Each folder was adapted from `learn_unix / learn_git \(legacy archive ignored\)`\.",
        "Each folder ships under this module’s `examples/`.",
    ),
    (
        r"adapted from \[`learn_unix / learn_git \(legacy archive ignored\)`\]\([^\)]+\)\.?",
        "ship with this course’s module `examples/`.",
    ),
    (
        r"Example trees for early modules were adapted from \[`learn_unix / learn_git \(legacy archive ignored\)`\]\([^\)]+\)\. Platform tools and the parent monorepo may carry additional notices\.\n?",
        "",
    ),
    (
        r"Path split from \[`[^\]]*\(legacy archive ignored\)[^\]]*`\]\([^\)]+\)(?: and \[`[^\]]+`\]\([^\)]+\))?\. Platform tools and the parent monorepo may carry additional notices\.\n?",
        "",
    ),
    (
        r"Path split from \[`[^\]]+`\]\([^\)]+\)(?: and \[`[^\]]+`\]\([^\)]+\))?\. Platform tools and the parent monorepo may carry additional notices\.\n?",
        "",
    ),
    (r" \(legacy archive ignored\)", ""),
    (r"Legacy combined path still lives in  \(archive; prefer \*\*learn_unix\*\* / \*\*learn_git\*\*\)\.", ""),
    (r"Legacy combined path: this module’s `examples/`\.", ""),
    (r"Legacy combined path: this module’s `examples/`", ""),
    (
        r"- Details also mirrored from legacy \[`this course/SANDBOX\.md`\]\(\.\./this course/SANDBOX\.md\)\n?",
        "",
    ),
    (r"learn_unix / learn_git \(legacy archive ignored\)", "this course"),
    (r"learn_verilog / learn_systemverilog \(legacy archive ignored\)", "learn_verilog"),
    (r"learn_digital \(legacy archive ignored\)", "learn_digital"),
]


def main() -> None:
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
            for pat, repl in SUBS:
                text = re.sub(pat, repl, text)
            if text != orig:
                path.write_text(text, encoding="utf-8", newline="\n")
                n += 1
                print("fix", path.relative_to(ROOT))
    print(f"fixed={n}")


if __name__ == "__main__":
    main()
