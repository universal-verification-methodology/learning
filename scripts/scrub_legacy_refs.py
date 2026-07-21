#!/usr/bin/env python3
"""Scrub legacy combined-course references from active catalog courses."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

LEGACY = [
    "learn_digital_verilog",
    "learn_uvm2017_sv_verilator",
    "learn_verilog_systemverilog",
    "learn_verilator_iverilog",
    "learn_unix_git",
    "learn_uart_spi_i2c",
    "verification_planning_management",
    "learn_uvm_pyuvm",
]

# Exact path / markdown link replacements (order matters: longer first)
REPLACEMENTS: list[tuple[str, str]] = [
    # Markdown links to sibling legacy
    (
        r"\[`?\.\./learn_digital_verilog/?`?\]\(\.\./learn_digital_verilog/?\)",
        "[`../LEGACY.md`](../LEGACY.md) (archive; prefer **learn_digital** / **learn_verilog**)",
    ),
    (
        r"\[`?\.\./learn_verilog_systemverilog/?`?\]\(\.\./learn_verilog_systemverilog/?\)",
        "[`../LEGACY.md`](../LEGACY.md) (archive; prefer **learn_verilog** / **learn_systemverilog**)",
    ),
    (
        r"\[`?\.\./learn_verilator_iverilog/?`?\]\(\.\./learn_verilator_iverilog/?\)",
        "[`../examples/verilator-hello/`](../examples/verilator-hello/) or [`../LEGACY.md`](../LEGACY.md)",
    ),
    (
        r"\[`?\.\./learn_unix_git/?`?\]\(\.\./learn_unix_git/?\)",
        "[`../LEGACY.md`](../LEGACY.md) (archive; prefer **learn_unix** / **learn_git**)",
    ),
    (
        r"\[`?\.\./learn_uart_spi_i2c/?`?\]\(\.\./learn_uart_spi_i2c/?\)",
        "[`../LEGACY.md`](../LEGACY.md) (archive; prefer **learn_uart** / **learn_spi** / **learn_i2c**)",
    ),
    (
        r"\[`?\.\./learn_uvm2017_sv_verilator/?`?\]\(\.\./learn_uvm2017_sv_verilator/?\)",
        "[`../examples/verilator-uvm-hello/`](../examples/verilator-uvm-hello/) (in-course) · [`../LEGACY.md`](../LEGACY.md)",
    ),
    (
        r"\[`?\.\./learn_uvm_pyuvm/?`?\]\(\.\./learn_uvm_pyuvm/?\)",
        "[`../../learn_cocotb/examples/cocotb-hello/`](../../learn_cocotb/examples/cocotb-hello/) · [`../LEGACY.md`](../LEGACY.md)",
    ),
    (
        r"\[`?\.\./verification_planning_management/?`?\]\(\.\./verification_planning_management/?\)",
        "**learn_verification_planning_management** · [`../LEGACY.md`](../LEGACY.md)",
    ),
    # GitHub URLs
    (
        "https://github.com/universal-verification-methodology/learn_digital_verilog",
        "https://github.com/universal-verification-methodology/learn_digital",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_unix_git",
        "https://github.com/universal-verification-methodology/learn_unix",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_uart_spi_i2c",
        "https://github.com/universal-verification-methodology/learn_uart",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_uvm2017_sv_verilator",
        "https://github.com/universal-verification-methodology/learn_uvm2017",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_uvm_pyuvm",
        "https://github.com/universal-verification-methodology/learn_pyuvm",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_verilator_iverilog",
        "https://github.com/universal-verification-methodology/learn_verilator",
    ),
    (
        "https://github.com/universal-verification-methodology/learn_verilog_systemverilog",
        "https://github.com/universal-verification-methodology/learn_verilog",
    ),
    (
        "https://github.com/universal-verification-methodology/verification_planning_management",
        "https://github.com/universal-verification-methodology/learn_verification_planning_management",
    ),
]

# Plain-text id → guidance (avoid breaking LEGACY.md / ignore rules)
PLAIN: list[tuple[str, str]] = [
    ("courses/learn_uvm2017_sv_verilator", "courses/learn_uvm2017/examples/verilator-uvm-hello"),
    ("cd courses/learn_uvm2017_sv_verilator", "cd courses/learn_uvm2017/examples/verilator-uvm-hello"),
    ("cd courses/learn_uvm_pyuvm", "cd courses/learn_cocotb/examples/cocotb-hello"),
    ("cd learn_uvm_pyuvm", "cd learn_cocotb/examples/cocotb-hello"),
    ("cd learn_uvm2017_sv_verilator", "cd learn_uvm2017/examples/verilator-uvm-hello"),
    ("module1/tests/cocotb_tests", "tests"),
    ("source .venv/bin/activate", "source .venv/bin/activate  # or: pip install cocotb"),
]

STRETCH_DIGITAL = re.compile(
    r"## Stretch \(optional\)\s*\n\s*\nPeek at .*learn_digital_verilog.*\n?",
    re.I,
)
STRETCH_REPL = (
    "## Stretch (optional)\n\n"
    "Sketch the same idea on paper, or continue to **learn_verilog** when you want RTL labs.\n"
)

EXAMPLES_VERILATOR_OFFLINE = """# Module 10 examples — Build & run a Verilator example

Offline only. Use the **in-course** hello (not the ignored legacy combined tree).

## Prompt

1. Open [`../examples/verilator-hello/`](../examples/verilator-hello/).
2. Run `make run` and record pass/fail plus Verilator version.
3. Optional stretch: try [`../../learn_uvm2017/examples/verilator-uvm-hello/`](../../learn_uvm2017/examples/verilator-uvm-hello/) after UVM modules.
"""

EXAMPLES_COCOTB_OFFLINE = """# Module 10 examples — Run a cocotb example

Offline only. Use the **in-course** hello.

## Prompt

1. Open [`../examples/cocotb-hello/`](../examples/cocotb-hello/).
2. From `tests/`, run `make SIM=verilator TEST=test_and_gate`.
3. Record simulator + cocotb versions and the pass/fail line.
"""


def active_courses() -> list[str]:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    return [c["id"] for c in cat["courses"]]


def scrub_text(text: str, course: str) -> str:
    out = text
    for pat, repl in REPLACEMENTS:
        out = re.sub(pat, repl, out)
    # Course-local EXAMPLES stretch for digital
    if course == "learn_digital":
        out = STRETCH_DIGITAL.sub(STRETCH_REPL, out)
    # Plain string replacements (non-link)
    for old, new in PLAIN:
        if old in out:
            # Don't rewrite LEGACY.md mapping tables aggressively inside comments about archives
            out = out.replace(old, new)
    # Remaining bare legacy ids → pass-3 phrasing (skip if already "LEGACY" context nearby)
    bare_map = {
        "learn_digital_verilog": "learn_digital (legacy archive ignored)",
        "learn_verilog_systemverilog": "learn_verilog / learn_systemverilog (legacy archive ignored)",
        "learn_verilator_iverilog": "learn_verilator / learn_iverilog (legacy archive ignored)",
        "learn_unix_git": "learn_unix / learn_git (legacy archive ignored)",
        "learn_uart_spi_i2c": "learn_uart / learn_spi / learn_i2c (legacy archive ignored)",
        "learn_uvm2017_sv_verilator": "learn_uvm2017/examples/verilator-uvm-hello (legacy archive ignored)",
        "learn_uvm_pyuvm": "learn_cocotb/examples/cocotb-hello or learn_pyuvm (legacy archive ignored)",
        "verification_planning_management": "learn_verification_planning_management (legacy archive ignored)",
    }
    for old, new in bare_map.items():
        # skip files that are the policy doc
        out = out.replace(f"`{old}`", f"`{new}`")
        # bare remaining (paths already handled)
        if f"../{old}" in out:
            out = out.replace(f"../{old}", f"../LEGACY.md")
    return out


def main() -> None:
    changed = 0
    for course in active_courses():
        root = ROOT / "courses" / course
        if not root.is_dir():
            continue
        # Special full-file replacements
        v_ex = root / "module10-offline-verilator-example" / "EXAMPLES.md"
        if course == "learn_verilator" and v_ex.exists():
            v_ex.write_text(EXAMPLES_VERILATOR_OFFLINE, encoding="utf-8")
            changed += 1
            print("rewrite", v_ex.relative_to(ROOT))
        c_ex = root / "module10-offline-cocotb-example" / "EXAMPLES.md"
        if course == "learn_cocotb" and c_ex.exists():
            c_ex.write_text(EXAMPLES_COCOTB_OFFLINE, encoding="utf-8")
            changed += 1
            print("rewrite", c_ex.relative_to(ROOT))
        p_ex = root / "module10-offline-pyuvm-example" / "EXAMPLES.md"
        if course == "learn_pyuvm" and p_ex.exists():
            p_ex.write_text(
                "# Offline pyuvm / cocotb\n\n"
                "Start with the in-course cocotb hello:\n\n"
                "[`../../learn_cocotb/examples/cocotb-hello/`](../../learn_cocotb/examples/cocotb-hello/)\n\n"
                "Legacy `learn_uvm_pyuvm` is ignored — see [`../LEGACY.md`](../LEGACY.md).\n",
                encoding="utf-8",
            )
            changed += 1
            print("rewrite", p_ex.relative_to(ROOT))

        for path in root.rglob("*"):
            try:
                if not path.is_file():
                    continue
            except OSError:
                continue
            if path.suffix.lower() not in {".md", ".sh", ".yaml", ".yml", ".txt", ".json"}:
                continue
            # skip generated media sidecars that are huge? json quizzes ok
            if "obj_dir" in path.parts or "sim_build" in path.parts or "frames" in path.parts:
                continue
            if "audio" in path.parts and path.suffix == ".json":
                pass  # allow slide_timings
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if not any(leg in text for leg in LEGACY):
                continue
            # Never rewrite courses/LEGACY.md via this loop (not under active course)
            new = scrub_text(text, course)
            if new != text:
                path.write_text(new, encoding="utf-8", newline="\n")
                changed += 1
                print("scrub", path.relative_to(ROOT))
    print(f"done files_touched={changed}")


if __name__ == "__main__":
    main()
