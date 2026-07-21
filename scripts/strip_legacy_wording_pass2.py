#!/usr/bin/env python3
"""Second pass: remove remaining legacy path leftovers in catalog courses."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

SUBS = [
    (r"learn_uvm2017_sv_verilator", "examples/verilator-uvm-hello"),
    (r"learn_verilator_iverilog", "examples/verilator-hello"),
    (r"learn_uvm_pyuvm", "learn_cocotb/examples/cocotb-hello"),
    (r"learn_uart_spi_i2c", "this course"),
    (r"learn_digital_verilog", "learn_digital"),
    (r"learn_verilog_systemverilog", "learn_verilog / learn_systemverilog"),
    (r"\[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r"\[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)", ""),
    (r" or \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r" · \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r" \(see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)\)", ""),
    (r"— see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r"see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r"ignored legacy combined tree", "external archive"),
    (r"ignored legacy tree", "external archive"),
    (r"ignored legacy", "external"),
    (r"legacy course", "course examples"),
    (
        r"Path split from \[`[^\]]+`\]\(https://github\.com/universal-verification-methodology/[^\)]+\)\. Platform tools and the parent monorepo may carry additional notices\.\n?",
        "",
    ),
    (
        r"- \*\*(Legacy|Offline legacy):\*\* \[`[^\]]+`\]\(https://github\.com/universal-verification-methodology/[^\)]+\)\n",
        "",
    ),
]


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
            for pat, repl in SUBS:
                text = re.sub(pat, repl, text)
            # Fix double spaces left by removals in prose (not indentation — only "  " mid-line after link removal is rare; skip)
            if text != orig:
                path.write_text(text, encoding="utf-8", newline="\n")
                n += 1
                print("fix", path.relative_to(ROOT))
    print(f"fixed={n}")


if __name__ == "__main__":
    main()
