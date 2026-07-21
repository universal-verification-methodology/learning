#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ids = [c["id"] for c in json.loads((ROOT / "platform/assets/catalog.json").read_text(encoding="utf-8"))["courses"]]

SUBS = [
    (r"learn_unix / learn_git", "learn_unix"),
    (
        r"Legacy combined path:  \(archive; prefer \*\*learn_uart\*\* / \*\*learn_spi\*\* / \*\*learn_i2c\*\*\)\. ",
        "",
    ),
    (
        r"Optional: peek at UART examples under  \(archive; prefer \*\*learn_uart\*\* / \*\*learn_spi\*\* / \*\*learn_i2c\*\*\)\.",
        "Optional: work the prompts under this module’s `examples/`.",
    ),
    (
        r"Legacy combined path:  \(archive; prefer \*\*[^*]+\*\*(?: / \*\*[^*]+\*\*)*\)\.?",
        "",
    ),
    (
        r"under  \(archive; prefer \*\*[^*]+\*\*(?: / \*\*[^*]+\*\*)*\)",
        "under this module’s `examples/`",
    ),
    (r" \(legacy archive — fidelity-only; commands below are canonical\)\n", "\n"),
    (r" \(legacy archive — fidelity-only; commands documented here\)\n", "\n"),
    (
        r" 2\. export UVM_HOME=\$PWD/tools/uvm-2017/1800\.2-2017-1\.0/src\n \(or your site UVM install\)\n 3\. cd module1/tests/uvm_tests\n 4\. make run SIM=verilator TEST=test_and_gate_uvm\n",
        " 2. export UVM_HOME=/path/to/1800.2-2017-1.0/src\n"
        " 3. make run SIM=verilator\n",
    ),
    (
        r" module1/tests/uvm_tests/Makefile\n",
        " Makefile\n",
    ),
    (
        r" export UVM_HOME=\$PWD/tools/uvm-2017/1800\.2-2017-1\.0/src\n",
        " export UVM_HOME=/path/to/1800.2-2017-1.0/src\n",
    ),
    (
        r"\./scripts/module1\.sh --uvm-tests\n \(orchestrator sets UVM_HOME and runs selected tests\)\n",
        " make dry-run   # then make run SIM=verilator\n",
    ),
]

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
            print("fix", path.relative_to(ROOT))

# syllabus TOC
for rel in ["syllabus.md", "platform/syllabus.md"]:
    p = ROOT / rel
    t = p.read_text(encoding="utf-8")
    t2 = re.sub(r"\n22\. \[Migration from existing courses\]\(#migration-from-existing-courses\)\n", "\n", t)
    if t2 != t:
        p.write_text(t2, encoding="utf-8", newline="\n")
        print("toc", rel)
