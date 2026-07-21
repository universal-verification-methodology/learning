#!/usr/bin/env python3
"""Replace remaining learner-facing 'legacy …' phrases in catalog courses."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ids = [c["id"] for c in json.loads((ROOT / "platform/assets/catalog.json").read_text(encoding="utf-8"))["courses"]]

SUBS = [
    (r"Python \+ legacy \[`", "Python + [`"),
    (r"Track A — Planning docs / legacy", "Track A — Planning docs"),
    (r"\*\*A — Planning docs / legacy\*\*", "**A — Planning docs**"),
    (r"open legacy docs under", "open docs under"),
    (r"Open legacy examples under", "Open examples under"),
    (r"Open the legacy offline", "Open the offline"),
    (r"open the legacy offline", "open the offline"),
    (r"the legacy offline course", "the in-course hello"),
    (r"legacy offline course", "in-course hello"),
    (r"legacy offline", "offline"),
    (r"legacy examples", "course examples"),
    (r"legacy notes", "course notes"),
    (r"legacy UVM hierarchy notes", "UVM hierarchy notes"),
    (r"legacy trees for the primary path", "external archives for the primary path"),
    (r"legacy learn-uvm-pyuvm tree", "cocotb-hello example"),
    (r"legacy learn Verilator Icarus course tree", "local iverilog examples"),
    (r"legacy learn Verilator Icarus course", "local iverilog flow"),
    (r"every legacy chapter", "every optional chapter"),
    (r"one legacy example", "one offline example"),
    (r"the legacy \.venv", "a project venv"),
    (r"legacy \.venv", "project venv"),
    (r"Shared UVM-role modules via sketches \+ legacy examples", "Shared UVM-role modules via sketches + examples"),
    (r"Track A \+ legacy \[`", "Track A + [`"),
    (r"in the legacy verification planning materials", "in this course’s examples"),
    (r"the legacy planning materials", "this course’s examples"),
    (r"legacy planning materials", "this course’s examples"),
    (r"peek at an I²C testbench in the legacy", "sketch an I²C testbench in"),
    (r"compare your list to a SPI sketch in the legacy", "compare your list to a SPI sketch in"),
    (r"enter the legacy offline course", "enter the in-course hello"),
    (r"If the legacy offline course is checked out, ", ""),
    (r"skim legacy notes in", "skim notes in"),
    (r"Optional: peek at legacy ", "Optional: peek at "),
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
