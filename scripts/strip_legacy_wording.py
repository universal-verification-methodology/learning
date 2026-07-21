#!/usr/bin/env python3
"""Strip learner-facing legacy wording from active catalog courses only.

Safe: exact substitutions only — no whitespace normalization.
Does not touch ignored legacy course trees.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

TEXT_SUFFIXES = {".md", ".sh", ".txt", ".yaml", ".yml", ".json"}

# Exact / regex replacements applied in order (most specific first).
SUBS: list[tuple[str, str]] = [
    # Optional Accellera path via legacy tree
    (
        r"\n# optional — Accellera tree under the ignored legacy course \(if present\)\n"
        r"export UVM_HOME=\"\$PWD/\.\./\.\./learn_uvm2017_sv_verilator/tools/uvm-2017/1800\.2-2017-1\.0/src\"\n",
        "\n",
    ),
    (
        r"\n# Optional monorepo convenience \(archive fidelity only — not required\):\n"
        r"#   export UVM_HOME=\$PWD/\.\./\.\./learn_uvm2017_sv_verilator/tools/uvm-2017/1800\.2-2017-1\.0/src\n",
        "\n",
    ),
    (
        r"Does \*\*not\*\* require editing the ignored legacy tree `learn_uvm2017_sv_verilator` \(see \[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)\)\.\n\n",
        "",
    ),
    (
        r"Does \*\*not\*\* require the ignored legacy tree `learn_uvm_pyuvm` \(see \[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)\)\.\n\n",
        "",
    ),
    (
        r"Then return here for pyuvm-specific modules\. The ignored archive `learn_uvm_pyuvm` is not required — see \[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)\.\n",
        "Then return here for pyuvm-specific modules.\n",
    ),
    (
        r"- The ignored legacy tree is optional convenience only — see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)\n",
        "",
    ),
    (
        r"Offline only\. Use the \*\*in-course\*\* hello \(not the ignored legacy combined tree\)\.\n",
        "Offline only. Use the **in-course** hello.\n",
    ),
    # Markdown links to combined legacy trees
    (
        r"\[`\.\./learn_verilator_iverilog/`\]\(\.\./learn_verilator_iverilog/\)",
        "[`../examples/verilator-hello/`](../examples/verilator-hello/)",
    ),
    (
        r"\[`\.\./learn_uvm2017_sv_verilator/`\]\(\.\./learn_uvm2017_sv_verilator/\)",
        "[`../examples/verilator-uvm-hello/`](../examples/verilator-uvm-hello/)",
    ),
    (
        r"\[`\.\./learn_uvm_pyuvm/`\]\(\.\./learn_uvm_pyuvm/\)",
        "[`../../learn_cocotb/examples/cocotb-hello/`](../../learn_cocotb/examples/cocotb-hello/)",
    ),
    (
        r"\[`\.\./verification_planning_management/`\]\(\.\./verification_planning_management/\)",
        "this module’s `examples/`",
    ),
    (
        r"\[`\.\./learn_unix_git/`\]\(\.\./learn_unix_git/\)",
        "this module’s `examples/`",
    ),
    (
        r"\[`\.\./learn_digital_verilog/`\]\(\.\./learn_digital_verilog/\)",
        "this module’s `examples/`",
    ),
    (
        r"\[`\.\./learn_verilog_systemverilog/`\]\(\.\./learn_verilog_systemverilog/\)",
        "this module’s `examples/`",
    ),
    (
        r"\[`\.\./learn_uart_spi_i2c/`\]\(\.\./learn_uart_spi_i2c/\)",
        "this module’s `examples/`",
    ),
    # Bare path mentions in prose / bash
    (r"courses/learn_uvm2017_sv_verilator", "courses/learn_uvm2017/examples/verilator-uvm-hello"),
    (r"courses/learn_verilator_iverilog", "courses/learn_verilator/examples/verilator-hello"),
    (r"courses/learn_uvm_pyuvm", "courses/learn_cocotb/examples/cocotb-hello"),
    (r"\.\./learn_verilator_iverilog/", "../examples/verilator-hello/"),
    (r"\.\./learn_uvm2017_sv_verilator/", "../examples/verilator-uvm-hello/"),
    (r"\.\./learn_uvm_pyuvm/", "../../learn_cocotb/examples/cocotb-hello/"),
    (r"\.\./verification_planning_management/", "./"),
    # Wording
    (r"Combined legacy:", "Sibling path:"),
    (r"Open the legacy course:", "Open the in-course hello:"),
    (r"Open the legacy course next to this curriculum", "Open the in-course hello next to this curriculum"),
    (r"from the legacy course", "from the in-course hello"),
    (r"in the legacy Verilator tree", "in examples/verilator-hello"),
    (r"in the legacy course tree", "in this module’s examples"),
    (r"the legacy course tree", "this course’s examples"),
    (r"the legacy Verilator course tree", "examples/verilator-hello"),
    (r"the legacy offline course tree", "the in-course hello"),
    (r"the legacy tree", "the in-course hello"),
    (r"legacy course", "in-course hello"),
    (r"legacy module", "module"),
    (r"legacy examples tree", "examples tree"),
    (r"Peek at \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\).*?\n", ""),
    (r" or \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r" · \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r" \(see LEGACY\.md\)", ""),
    (r"see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r"see \[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)", ""),
    (r"— see \[`\.\./LEGACY\.md`\]\(\.\./LEGACY\.md\)", ""),
    (r"— see \[`\.\./\.\./LEGACY\.md`\]\(\.\./\.\./LEGACY\.md\)", ""),
    (r"adapted from `learn_unix_git`", "adapted from Track A examples"),
    (r"Adapted from `learn_unix_git`", "Adapted from Track A examples"),
    (r"copied from the proven `learn_unix_git` trees", "under this module’s `examples/`"),
    (r"from the proven `learn_unix_git` trees", "under this module’s `examples/`"),
    (r"learn_unix_git", "this course"),
    # Footers
    (
        r"Path split from \[`learn_uvm2017_sv_verilator`\]\(https://github\.com/universal-verification-methodology/learn_uvm2017_sv_verilator\)\. Platform tools and the parent monorepo may carry additional notices\.\n",
        "",
    ),
    (
        r"Path split from \[`learn_verilator_iverilog`\]\(https://github\.com/universal-verification-methodology/learn_verilator_iverilog\)\. Platform tools and the parent monorepo may carry additional notices\.\n",
        "",
    ),
    (
        r"Path split from \[`learn_[a-z0-9_]+`\]\(https://github\.com/universal-verification-methodology/learn_[a-z0-9_]+\)\. Platform tools and the parent monorepo may carry additional notices\.\n",
        "",
    ),
    (
        r"- \*\*Legacy:\*\* \[`[^\]]+`\]\(https://github\.com/universal-verification-methodology/[^\)]+\)\n",
        "",
    ),
    (
        r"- \*\*Offline legacy:\*\* \[`[^\]]+`\]\(https://github\.com/universal-verification-methodology/[^\)]+\)\n",
        "",
    ),
]


def scrub_text(text: str) -> str:
    for pat, repl in SUBS:
        text = re.sub(pat, repl, text)
    return text


def scrub_module_sh_legacy_block(text: str) -> str:
    """Replace LEGACY=... fi blocks with a generic Track A note."""
    text2, n = re.subn(
        r"\n[ \t]*LEGACY=.*?\n[ \t]*if \[\[ -d \"\$LEGACY\" \]\]; then.*?fi\n",
        "\n    echo \"[INFO] Track A uses this course’s examples/ (no external archive required)\"\n",
        text,
        count=1,
        flags=re.S,
    )
    return text2 if n else text


def scrub_demo_uvm_cand(text: str) -> str:
    """Remove optional legacy UVM_HOME probe from demo scripts."""
    text = re.sub(
        r"\nif \[\[ -z \"\$\{UVM_HOME:-\}\" \]\]; then.*?fi\n",
        "\nif [[ -z \"${UVM_HOME:-}\" ]]; then\n"
        "  echo \"UVM_HOME unset — set it to Accellera UVM 2017 …/src (see hello README)\"\n"
        "fi\n",
        text,
        count=1,
        flags=re.S,
    )
    return text


def main() -> None:
    ids = [c["id"] for c in json.loads(CATALOG.read_text(encoding="utf-8"))["courses"]]
    n = 0
    for cid in ids:
        root = ROOT / "courses" / cid
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            try:
                if not path.is_file():
                    continue
            except OSError:
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            if any(x in path.parts for x in ("obj_dir", "sim_build", "frames", "audio", "_scaffold")):
                continue
            if path.name.startswith("_scaffold") or path.name == "gen_pass1_media.py":
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            orig = text
            text = scrub_text(text)
            if path.name == "module.sh":
                text = scrub_module_sh_legacy_block(text)
            if path.name.startswith("_demo_") and "UVM_HOME" in text:
                text = scrub_demo_uvm_cand(text)
            if text != orig:
                path.write_text(text, encoding="utf-8", newline="\n")
                n += 1
                print("fix", path.relative_to(ROOT))
    print(f"fixed={n}")


if __name__ == "__main__":
    main()
