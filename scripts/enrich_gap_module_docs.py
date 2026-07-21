#!/usr/bin/env python3
"""Enrich EXAMPLES.md / CHECKLIST.md for gap courses from MODULES.md + transcripts."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSES = [
    "learn_python_hw",
    "learn_sv_tb",
    "learn_cocotb",
    "learn_formal",
]

ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*"
    r"(?:`([^`]+)`|—)\s*\|\s*([^|]+)\|",
    re.MULTILINE,
)

# Module-specific Track A prompt hints (title keywords → extra prompts)
HINTS: dict[str, list[str]] = {
    "python-async-tb": [
        "Name the three pieces: async def, await, and the cocotb test decorator.",
        "Sketch a tiny async test that awaits a timer, then pokes one DUT signal (on paper is fine).",
    ],
    "stim-as-data": [
        "Write four AND rows as a Python list of dicts `{a, b, y}` and loop with asserts.",
        "Break one expected `y` on purpose and name the failing index.",
    ],
    "pytest-assert-lab": [
        "Write expect vs actual for hex `0xA5` and say what FAIL should print.",
        "Explain golden file vs inline expected in one sentence each.",
    ],
    "file-vector-io": [
        "Sketch a stim/exp file format for an and2 (four rows) and how a TB would apply one row.",
        "Name one pitfall of hand-editing vector files (column drift, wrong radix, …).",
    ],
    "offline-venv-pip": [
        "Create a throwaway venv, activate it, and `pip install` one tiny package you choose.",
        "Write down how you would freeze versions for a shared lab machine.",
    ],
    "why-async-sim": [
        "Explain why await on an edge is a better mental model than busy-polling sim time.",
        "Map one SV `@(posedge clk)` habit to one Python await habit.",
    ],
    "offline-hello-deps": [
        "List the deps you would install before a first cocotb Makefile run (Python, sim, cocotb).",
        "Note one version pin you would put in requirements.txt and why.",
    ],
    "tb-anatomy": [
        "Label DUT, TB, and which side drives each port on a tiny and2 sketch.",
        "Write a `$display` then `$finish` outline for a one-vector smoke.",
    ],
    "self-check-tb": [
        "Write stimulus → reference expect → compare for and2 with a=1,b=1,y=1.",
        "Name what goes wrong if you only `$display` without comparing.",
    ],
    "tb-clock-reset": [
        "Sketch sync reset release after two posedges with `rst_n` timing labeled.",
        "Say when async assert / sync deassert is preferred in one sentence.",
    ],
    "task-vs-function": [
        "Give one case that must be a task (time-consuming) and one that must be a function.",
        "Explain why calling a task from a function is illegal.",
    ],
    "fork-join": [
        "Draw fork/join vs join_any vs join_none for clock + stimulus threads.",
        "Name one deadlock you can create with join and a forever clock.",
    ],
    "vif-wiring": [
        "Sketch interface → virtual interface → driver: who holds the instance?",
        "Explain what breaks if two drivers poke the same vif signal.",
    ],
    "sv-class-sketch": [
        "Sketch a base transaction class and one extended type with one extra field.",
        "Say what `super.new` is for in one sentence.",
    ],
    "crv-lite": [
        "Write a tiny `rand` field with one constraint and say what `randomize()` returns on fail.",
        "Explain why a fixed seed helps debug a failing random test.",
    ],
    "cover-bins": [
        "Define a coverpoint with low/mid/high bins and mark which bin a sample of 5 hits.",
        "Distinguish cover (observe) from assert (prove) in one sentence each.",
    ],
    "sva-timeline": [
        "Draw `a |-> b` vs `a |=> b` on a 4-cycle timeline with one overlapping pass.",
        "Give one vacuous-pass example (antecedent never true).",
    ],
    "tb-vs-uvm-map": [
        "Map six classic TB roles to UVM components (test, seq, driver, monitor, agent, scoreboard).",
        "Say what stays the same when you move from directed TB to UVM.",
    ],
    "cocotb-triggers": [
        "Contrast `RisingEdge`, `Timer`, and `First` with one sentence each.",
        "Sketch when you would Combine two triggers vs await them in sequence.",
    ],
    "cocotb-clock-helper": [
        "Start a Clock with period 10 and list the first three rising-edge times.",
        "Explain why Clock.start is preferred over a hand-rolled forever toggle.",
    ],
    "cocotb-dut-handle": [
        "Resolve a hierarchical path like `dut.uart.txd` and peek `.value`.",
        "Name one failure mode of poking the wrong hierarchy level.",
    ],
    "cocotb-binary-value": [
        "Convert 8-bit `0xA5` to a bit string and state endianness assumptions.",
        "Show how width mismatch can silently truncate.",
    ],
    "cocotb-scoreboard": [
        "Enqueue expect `0xA5`, observe match, then a deliberate mismatch — what should fail?",
        "Explain empty-queue observe as a bug class.",
    ],
    "cocotb-uvm-map": [
        "Map dut handle ↔ vif, await ↔ edge, Python check ↔ scoreboard.",
        "Say what cocotb does not replace in a full UVM env.",
    ],
    "waveform-lab": [
        "Poke D=1, step a posedge, and say where you put the cursor to confirm q.",
        "Name two signals you would dump in a real cocotb VCD for this habit.",
    ],
    "offline-cocotb-example": [
        "From a cocotb example tree: create venv, install, run make (or note blockers).",
        "Paste the first PASS/FAIL line you see and explain it.",
    ],
    "assert-assume-cover": [
        "Tag three statements correctly as assert, assume, and cover — justify each.",
        "Explain what goes wrong if you assert an input constraint instead of assuming it.",
    ],
    "formal-vacuity": [
        "Show `a |-> b` with a always 0 and explain the vacuous pass.",
        "Name one way to detect vacuity (cover antecedent, or tool vacuity check).",
    ],
    "formal-bmc-bound": [
        "With bug at cycle 3, pick k=2 vs k=5 and predict PASS_BOUND vs CEX.",
        "Explain why a small-k PASS is not an unbounded proof.",
    ],
    "formal-counterexample": [
        "Step a short CEX and name the failing cycle and signal.",
        "Say what you would change in RTL or the property after reading it.",
    ],
    "formal-induction": [
        "State base case and inductive step in one sentence each for a simple invariant.",
        "Explain when BMC alone is not enough.",
    ],
    "synth-lint": [
        "List three RTL habits that make proofs harder (latches, async loops, …).",
        "Run or sketch a lint pass and name one finding you would fix first.",
    ],
    "hdl-style": [
        "Rewrite one messy always block into a prove-friendlier style (reset, defaults).",
        "Explain why X-pessimism or incomplete case can hide bugs from formal.",
    ],
    "offline-bmc-hello": [
        "Sketch a minimal `.sby` BMC job (mode, depth, read HDL + properties).",
        "Say where you look first in the job log on FAIL vs PASS.",
    ],
}


def parse_modules(course: str) -> list[dict]:
    path = ROOT / "courses" / course / "docs" / "MODULES.md"
    text = path.read_text(encoding="utf-8")
    out = []
    for m in ROW.finditer(text):
        n, kind, title, rel, lab, _status = m.groups()
        mod_dir = (ROOT / "courses" / course / rel.replace("../", "")).parent
        # rel is like ../module00-intro/README.md
        folder = Path(rel.replace("../", "")).parts[0]
        mod_path = ROOT / "courses" / course / folder
        out.append(
            {
                "n": n.zfill(2),
                "kind": kind,
                "title": title,
                "lab": lab,
                "path": mod_path,
                "folder": folder,
            }
        )
    return out


def concept_from_transcript(mod: Path) -> str | None:
    t = mod / "transcript.md"
    if not t.exists():
        return None
    text = t.read_text(encoding="utf-8")
    parts = re.split(r"^## Slide \d+ —[^\n]*\n", text, maxsplit=2, flags=re.M)
    # After first heading body
    m = re.search(r"^## Slide 1 —[^\n]*\n\n(.+?)(?=\n## |\Z)", text, re.S | re.M)
    if not m:
        return None
    para = " ".join(m.group(1).strip().split())
    if len(para) > 220:
        para = para[:217].rsplit(" ", 1)[0] + "…"
    return para


def examples_md(course: str, info: dict) -> str:
    title = info["title"]
    lab = info["lab"]
    kind = info["kind"]
    hints = HINTS.get(lab or "", []) or HINTS.get(info["folder"].split("-", 1)[-1], [])
    # folder-based: module03-stim-as-data → stim-as-data
    slug = info["folder"].split("-", 1)[-1] if "-" in info["folder"] else ""
    if not hints and slug:
        hints = HINTS.get(slug, [])
    # Also try full slug after moduleNN-
    full_slug = info["folder"][len("moduleXX-") :] if info["folder"].startswith("module") else ""
    # module00-intro → after first hyphen following digits
    m = re.match(r"module\d+-(.+)", info["folder"])
    if m:
        hints = HINTS.get(m.group(1), hints)

    concept = concept_from_transcript(info["path"])
    lines = [f"# Examples — {title}", ""]
    if kind == "lab" and lab:
        lines.append(f"Track A prompts. Browser lab **`{lab}`** is shipped.")
    elif kind == "offline":
        lines.append("Track A (local / offline). No browser lab for this module.")
    elif kind == "bridge":
        lines.append("Bridge module — connect ideas across tracks; paper or local notes are enough.")
    elif kind == "intro":
        lines.append("Orientation. Skim the tools shelf, then open module 01.")
    elif kind == "wrap":
        lines.append("Wrap-up. Recap what you can do; name the next course on the ladder.")
    else:
        lines.append("Practice prompts for this module.")
    lines += ["", "## Prompts", ""]
    lines.append(f"1. Restate the core idea of **{title}** in one sentence.")
    if concept:
        lines.append(f"2. In your own words, capture this beat: *{concept}*")
        n = 3
    else:
        lines.append("2. Sketch one worked example on paper (or in a tiny script / HDL file).")
        n = 3
    if hints:
        for h in hints[:2]:
            lines.append(f"{n}. {h}")
            n += 1
    else:
        lines.append(f"{n}. Optional: map the same idea to a tool or flow you already use.")
        n += 1
    lines += ["", "## Stretch", ""]
    if kind == "lab" and lab:
        lines.append(f"When ready, redo the same idea in the **`{lab}`** starter challenges.")
    elif kind == "offline":
        lines.append("When ready, run the offline steps once end-to-end and note any install blockers.")
    elif kind == "wrap":
        lines.append("Open the next course README and write one goal for your first module there.")
    else:
        lines.append("Optional: open a related browser lab from the tools index and compare vocabulary.")
    lines.append("")
    return "\n".join(lines)


def checklist_md(info: dict) -> str:
    title = info["title"]
    lab = info["lab"]
    kind = info["kind"]
    lines = [f"# Checklist — {title}", "", "## Track A — Local / offline", ""]
    lines.append("- [ ] Worked through at least one prompt in [EXAMPLES.md](EXAMPLES.md)")
    lines.append("- [ ] Can explain the outcome in my own words")
    if kind == "offline":
        lines.append("- [ ] Completed (or documented a blocker for) the offline install/run steps")
    lines += ["", f"## Track B — Browser lab" + (f" (`{lab}`)" if lab else ""), ""]
    if kind == "lab" and lab:
        lines.append(f"- [ ] Opened the **`{lab}`** lab (local tools server or live site)")
        lines.append("- [ ] Loaded starter + completed a few challenges")
    elif kind in ("intro", "wrap"):
        lines.append("- [ ] Opened the tools index and found where this course’s labs live")
        lines.append("- [ ] Or noted N/A if you are Track A only for now")
    else:
        lines.append("- [ ] Noted N/A for this module (no dedicated browser lab) **or** sampled a related lab")
    lines += ["", "## Done when", ""]
    if kind == "lab":
        lines.append("- [ ] I can do the task offline **or** I finished the browser challenges (preferably both)")
    else:
        lines.append("- [ ] I can explain this module’s idea and what to do next")
    lines.append("- [ ] Short quiz attempted (when present)")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    for course in COURSES:
        mods = parse_modules(course)
        if not mods:
            raise SystemExit(f"no modules parsed for {course}")
        for info in mods:
            p = info["path"]
            if not p.is_dir():
                print(f"SKIP missing {p}")
                continue
            (p / "EXAMPLES.md").write_text(examples_md(course, info), encoding="utf-8")
            (p / "CHECKLIST.md").write_text(checklist_md(info), encoding="utf-8")
            print(f"OK {course}/{info['folder']}")


if __name__ == "__main__":
    main()
