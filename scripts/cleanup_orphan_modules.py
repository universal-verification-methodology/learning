#!/usr/bin/env python3
"""Remove orphan module dirs not listed in docs/MODULES.md for the four new courses."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSES = [
    "learn_python_hw",
    "learn_sv_tb",
    "learn_cocotb",
    "learn_formal",
]


def keep_slugs(modules_md: Path) -> set[str]:
    text = modules_md.read_text(encoding="utf-8")
    # links like ../module03-stim-as-data/README.md
    return set(re.findall(r"\.\./(module\d{2}-[^/]+)/", text))


def main() -> None:
    for cid in COURSES:
        root = ROOT / "courses" / cid
        mods = keep_slugs(root / "docs" / "MODULES.md")
        print(f"=== {cid}: keep {len(mods)} ===")
        for p in sorted(root.glob("module*")):
            if not p.is_dir():
                continue
            if p.name in mods:
                print(f"  KEEP  {p.name}")
            else:
                print(f"  DEL   {p.name}")
                shutil.rmtree(p)
        # verify
        left = sorted(p.name for p in root.glob("module*") if p.is_dir())
        missing = sorted(mods - set(left))
        extra = sorted(set(left) - mods)
        if missing:
            print("  MISSING (need create):", missing)
        if extra:
            print("  EXTRA still:", extra)
        if not missing and not extra:
            print("  tree OK")


if __name__ == "__main__":
    main()
