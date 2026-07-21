#!/usr/bin/env python3
"""Audit active catalog courses for non-technical 'legacy' wording."""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
ids = [c["id"] for c in json.loads((ROOT / "platform/assets/catalog.json").read_text(encoding="utf-8"))["courses"]]

IGNORED_DIRS = {"obj_dir", "frames", "audio", "sim_build"}
# Lines where "legacy" is a legitimate technical/HDL term
OK_PATTERN = re.compile(
    r'legacy.*(idiom|style|fragment|always_ff|always_comb|always_latch|RTL|fixed.width|columns|behavior|migrate|construct|1364|1800)',
    re.I,
)

hits = []
for cid in ids:
    for p in (ROOT / "courses" / cid).rglob("*"):
        try:
            if not p.is_file():
                continue
        except OSError:
            continue
        if p.suffix.lower() not in {".md", ".sh", ".txt", ".yaml", ".yml", ".json"}:
            continue
        if any(x in p.parts for x in IGNORED_DIRS):
            continue
        try:
            t = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(t.splitlines(), 1):
            if re.search(
                r'(?i)\blegacy\b|LEGACY\.md|learn_unix_git|learn_uvm2017_sv_verilator|learn_verilator_iverilog|learn_uvm_pyuvm|learn_uart_spi_i2c',
                line,
            ):
                if not OK_PATTERN.search(line):
                    hits.append(f"{p.relative_to(ROOT)}:{i}: {line.strip()[:110]}")

print(f"Remaining non-technical legacy hits: {len(hits)}")
for h in hits:
    print(h)
