#!/usr/bin/env python3
"""Sync course labs in catalog.json from each course's docs/MODULES.md."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

# Lab column may be — or one/more `tool-id` values separated by /
ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*\[([^\]]+)\]"
    r"\([^)]+\)\s*\|\s*(?:`([^`]+)`(?:\s*/\s*`[^`]+`)*|—)\s*\|\s*[^|]+\s*\|",
    re.MULTILINE,
)

COURSES = {
    "learn_unix": {
        "title": "Unix for design",
        "focus": "Shell → scripts → project hygiene",
        "prereq": None,
        "modules": ROOT / "courses" / "learn_unix" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_unix",
    },
    "learn_git": {
        "title": "Git for coursework",
        "focus": "Model → commit → branch → remotes → deliver",
        "prereq": "learn_unix recommended",
        "modules": ROOT / "courses" / "learn_git" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_git",
    },
    "learn_digital": {
        "title": "Digital foundations",
        "focus": "Number systems → logic → FSM → datapath → memory",
        "prereq": None,
        "modules": ROOT / "courses" / "learn_digital" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_digital",
    },
    "learn_verilog": {
        "title": "Verilog RTL",
        "focus": "IEEE 1364 RTL coding",
        "prereq": "learn_digital recommended",
        "modules": ROOT / "courses" / "learn_verilog" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_verilog",
    },
    "learn_systemverilog": {
        "title": "SystemVerilog design",
        "focus": "IEEE 1800 design (not UVM)",
        "prereq": "learn_verilog",
        "modules": ROOT / "courses" / "learn_systemverilog" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_systemverilog",
    },
    "learn_uvm2017": {
        "title": "UVM 2017 methodology",
        "focus": "UVM 2017 (IEEE 1800.2) methodology literacy + offline practice",
        "prereq": "SystemVerilog + TB (learn_systemverilog recommended)",
        "modules": ROOT / "courses" / "learn_uvm2017" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_uvm2017",
    },
    "learn_verilator": {
        "title": "Verilator",
        "focus": "Verilator as a tool",
        "prereq": "Verilog; C++ helpful",
        "modules": ROOT / "courses" / "learn_verilator" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_verilator",
    },
    "learn_iverilog": {
        "title": "Icarus Verilog",
        "focus": "Icarus as a tool",
        "prereq": "Verilog",
        "modules": ROOT / "courses" / "learn_iverilog" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_iverilog",
    },
    "learn_pyuvm": {
        "title": "pyuvm",
        "focus": "cocotb → pyuvm",
        "prereq": "Python + Verilog + sim",
        "modules": ROOT / "courses" / "learn_pyuvm" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_pyuvm",
    },
    "learn_uart": {
        "title": "UART",
        "focus": "UART spec → RTL → TB → VIP map",
        "prereq": "Verilog",
        "modules": ROOT / "courses" / "learn_uart" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_uart",
    },
    "learn_spi": {
        "title": "SPI",
        "focus": "SPI wires & modes → RTL → TB → VIP map",
        "prereq": "Verilog",
        "modules": ROOT / "courses" / "learn_spi" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_spi",
    },
    "learn_i2c": {
        "title": "I²C",
        "focus": "I²C open-drain → RTL → TB → VIP map",
        "prereq": "Verilog",
        "modules": ROOT / "courses" / "learn_i2c" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_i2c",
    },
    "learn_hdl_simulator": {
        "title": "HDL Simulator path",
        "focus": "Browser HDL Simulator guided path",
        "prereq": "Verilog helpful",
        "modules": ROOT / "courses" / "learn_hdl_simulator" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_hdl_simulator",
    },
    "learn_verification_planning_management": {
        "title": "Verification planning",
        "focus": "Plan → coverage → CI → sign-off",
        "prereq": "Protocol or UVM helpful",
        "modules": ROOT
        / "courses"
        / "learn_verification_planning_management"
        / "docs"
        / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_verification_planning_management",
    },
    "learn_python_hw": {
        "title": "Python for hardware",
        "focus": "Python on-ramp for HW verification (before cocotb)",
        "prereq": "Unix helpful",
        "modules": ROOT / "courses" / "learn_python_hw" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_python_hw",
    },
    "learn_sv_tb": {
        "title": "SystemVerilog testbench",
        "focus": "Directed TB → CRV → SVA → cover (before UVM)",
        "prereq": "learn_systemverilog",
        "modules": ROOT / "courses" / "learn_sv_tb" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_sv_tb",
    },
    "learn_cocotb": {
        "title": "cocotb",
        "focus": "cocotb triggers → DUT handle → self-check (before pyuvm)",
        "prereq": "learn_python_hw recommended; Verilog + sim",
        "modules": ROOT / "courses" / "learn_cocotb" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_cocotb",
    },
    "learn_formal": {
        "title": "Formal verification intro",
        "focus": "Assert / assume / cover → BMC → counterexample (literacy)",
        "prereq": "learn_sv_tb or SVA lite; Verilog",
        "modules": ROOT / "courses" / "learn_formal" / "docs" / "MODULES.md",
        "course_root": ROOT / "courses" / "learn_formal",
    },
}


def module_slug(course_root: Path, n: str) -> str | None:
    prefix = f"module{n.zfill(2)}-"
    for child in sorted(course_root.iterdir()):
        if child.is_dir() and child.name.startswith(prefix):
            return child.name[len(prefix) :]
    return None


def slug_from_row(n: str, kind: str, tool_id: str | None, dir_slug: str | None) -> str:
    if kind == "intro":
        return "intro"
    if kind == "wrap":
        return "wrap"
    if kind == "offline":
        if dir_slug:
            return dir_slug
        if n == "21":
            return "sandbox"
        if tool_id == "course-makefile":
            return "offline-uvm-example"
    # Prefer on-disk module folder slug (handles dual-tool MODULES rows)
    if dir_slug:
        return dir_slug
    if tool_id:
        return tool_id
    return f"lab-{n}"


def parse_modules(path: Path, course_root: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    labs = []
    for m in ROW.finditer(text):
        n, kind, title, tool_id = m.group(1), m.group(2), m.group(3), m.group(4)
        tool_id = tool_id.strip() if tool_id else None
        if tool_id == "unix-git-practice":
            tool_id = None
        if tool_id == "course-makefile":
            # Offline makefile — not a browser tool id
            tool_id = None
        slug = slug_from_row(n, kind, tool_id, module_slug(course_root, n))
        labs.append(
            {
                "n": n.zfill(2),
                "slug": slug,
                "kind": kind,
                "title": title,
                "toolId": tool_id,
                "status": "shipped",
            }
        )
    return labs


def main() -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in cat["courses"]}

    for course_id, meta in COURSES.items():
        if course_id not in by_id:
            raise SystemExit(f"missing course id in catalog.json: {course_id}")
        if not meta["modules"].is_file():
            raise SystemExit(f"missing MODULES.md: {meta['modules']}")
        labs = parse_modules(meta["modules"], meta["course_root"])
        if not labs:
            raise SystemExit(f"no labs parsed from {meta['modules']}")
        course = by_id[course_id]
        course["status"] = "ready"
        course["title"] = meta["title"]
        course["focus"] = meta["focus"]
        course["prereq"] = meta["prereq"]
        course["labs"] = labs
        if "repo" not in course:
            course["repo"] = course_id
        print(f"{course_id}: {len(labs)} labs")

    CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {CATALOG.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
