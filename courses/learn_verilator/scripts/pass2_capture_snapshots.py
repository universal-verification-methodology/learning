#!/usr/bin/env python3
"""Capture lab/tools snapshots for learn_verilator."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / ".cursor/skills/module-slides/scripts/capture_lab_snapshot.py"
BASE = "http://127.0.0.1:8080/tools"
COURSE = ROOT / "courses/learn_verilator"

CAPTURES = [
    ("module00-intro", "index", "tools-index.png"),
    ("module01-iverilog-vs-verilator", "iverilog-vs-verilator", None),
    ("module02-sim-pipeline", "sim-pipeline", None),
    ("module03-verilator-lint-lab", "verilator-lint-lab", None),
    ("module04-dpi-cpp-tb", "dpi-cpp-tb", None),
    ("module05-tb-clock-reset", "tb-clock-reset", None),
    ("module06-verilator-trace", "verilator-trace", None),
    ("module07-wave-dump", "wave-dump", None),
    ("module08-verilator-public", "verilator-public", None),
    ("module09-verif-metrics", "verif-metrics", None),
    ("module11-wrap", "index", "tools-index.png"),
]


def main() -> int:
    rc = 0
    for slug, lab, name in CAPTURES:
        mod = COURSE / slug
        cmd = [
            sys.executable,
            str(SCRIPT),
            str(mod.relative_to(ROOT)).replace("\\", "/"),
            "--lab",
            lab,
            "--base",
            BASE,
            "--wait-ms",
            "2000",
            "--height",
            "900",
        ]
        if name:
            cmd.extend(["--name", name])
        print(f"\n=== {slug} ({lab}) ===")
        r = subprocess.run(cmd, cwd=ROOT).returncode
        if r != 0:
            rc = r
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
