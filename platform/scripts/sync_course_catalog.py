#!/usr/bin/env python3
"""Sync course labs in catalog.json from course MODULES.md (learn_git, learn_digital, learn_verilog)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "platform" / "assets" / "catalog.json"

ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*\[([^\]]+)\]"
    r"\([^)]+\)\s*\|\s*(?:`([^`]+)`|—)\s*\|\s*[^|]+\s*\|",
    re.MULTILINE,
)

COURSES = {
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
    if kind == "offline" and n == "21":
        return "sandbox"
    if tool_id:
        return tool_id
    if dir_slug:
        return dir_slug
    return f"lab-{n}"


def parse_modules(path: Path, course_root: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    labs = []
    for m in ROW.finditer(text):
        n, kind, title, tool_id = m.group(1), m.group(2), m.group(3), m.group(4)
        tool_id = tool_id.strip() if tool_id else None
        if tool_id == "unix-git-practice":
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
        labs = parse_modules(meta["modules"], meta["course_root"])
        course = by_id[course_id]
        course["status"] = "ready"
        course["title"] = meta["title"]
        course["focus"] = meta["focus"]
        course["prereq"] = meta["prereq"]
        course["labs"] = labs
        print(f"{course_id}: {len(labs)} labs")

    CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {CATALOG.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
