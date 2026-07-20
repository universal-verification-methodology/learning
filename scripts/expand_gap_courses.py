#!/usr/bin/env python3
"""Expand thin courses + register new gap tools in index/tools.md/MODULES."""
from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NEW_TOOLS = [
    ("pytest-assert-lab", "pytest assert / golden", "expect vs actual · 22 challenges", "pyuvm"),
    ("stim-as-data", "Stimulus as data", "Python vector lists · 22 challenges", "pyuvm"),
    ("cocotb-clock-helper", "cocotb Clock helper", "Clock.start · edge timeline · 22 challenges", "pyuvm"),
    ("cocotb-binary-value", "cocotb BinaryValue", "width + value → bits · 22 challenges", "pyuvm"),
    ("cocotb-scoreboard", "cocotb scoreboard sketch", "expect queue vs observe · 22 challenges", "pyuvm"),
    ("assert-assume-cover", "Assert / assume / cover", "property roles · 22 challenges", "formal"),
    ("formal-bmc-bound", "Formal BMC bound", "bound k vs bugAt · 22 challenges", "formal"),
    ("formal-counterexample", "Formal counterexample", "step CEX wave · 22 challenges", "formal"),
    ("formal-induction", "Formal induction sketch", "base + step · 22 challenges", "formal"),
    ("formal-vacuity", "Formal vacuity", "vacuous pass · 22 challenges", "formal"),
]

COURSE_MODULES = {
    "learn_python_hw": {
        "anchor": "15-learn_python_hw",
        "modules": [
            (0, "intro", "intro", "Welcome to Python for hardware", None),
            (1, "lab", "python-async-tb", "Python async TB", "python-async-tb"),
            (2, "offline", "offline-venv-pip", "venv + pip for HW tools", None),
            (3, "lab", "stim-as-data", "Stimulus as data", "stim-as-data"),
            (4, "lab", "pytest-assert-lab", "pytest assert / golden", "pytest-assert-lab"),
            (5, "lab", "file-vector-io", "HDL file / vector I/O", "file-vector-io"),
            (6, "bridge", "why-async-sim", "Why async fits simulation", None),
            (7, "offline", "offline-hello-deps", "Install preview (cocotb deps)", None),
            (8, "wrap", "wrap", "Python-for-HW complete", None),
        ],
    },
    "learn_sv_tb": {
        "anchor": "16-learn_sv_tb",
        "modules": [
            (0, "intro", "intro", "Welcome to SV testbench", None),
            (1, "lab", "tb-anatomy", "TB anatomy", "tb-anatomy"),
            (2, "lab", "self-check-tb", "Self-checking TB", "self-check-tb"),
            (3, "lab", "tb-clock-reset", "Clock + reset patterns", "tb-clock-reset"),
            (4, "lab", "task-vs-function", "Task vs function", "task-vs-function"),
            (5, "lab", "fork-join", "Fork / join", "fork-join"),
            (6, "lab", "file-vector-io", "File / vector I/O", "file-vector-io"),
            (7, "lab", "vif-wiring", "Virtual interface wiring", "vif-wiring"),
            (8, "lab", "sv-class-sketch", "Class / inheritance sketch", "sv-class-sketch"),
            (9, "lab", "crv-lite", "Constraint / random lite", "crv-lite"),
            (10, "lab", "cover-bins", "Coverpoint / bins", "cover-bins"),
            (11, "lab", "sva-timeline", "SVA implication timeline", "sva-timeline"),
            (12, "lab", "tb-vs-uvm-map", "TB vs UVM map", "tb-vs-uvm-map"),
            (13, "wrap", "wrap", "SV TB complete", None),
        ],
    },
    "learn_cocotb": {
        "anchor": "17-learn_cocotb",
        "modules": [
            (0, "intro", "intro", "Welcome to cocotb", None),
            (1, "lab", "python-async-tb", "Python async TB", "python-async-tb"),
            (2, "lab", "cocotb-triggers", "cocotb triggers", "cocotb-triggers"),
            (3, "lab", "cocotb-clock-helper", "cocotb Clock helper", "cocotb-clock-helper"),
            (4, "lab", "cocotb-dut-handle", "cocotb DUT handle", "cocotb-dut-handle"),
            (5, "lab", "cocotb-binary-value", "cocotb BinaryValue", "cocotb-binary-value"),
            (6, "lab", "cocotb-scoreboard", "cocotb scoreboard", "cocotb-scoreboard"),
            (7, "lab", "cocotb-uvm-map", "cocotb ↔ UVM roles", "cocotb-uvm-map"),
            (8, "lab", "self-check-tb", "Self-check pattern", "self-check-tb"),
            (9, "lab", "waveform-lab", "Waves literacy", "waveform-lab"),
            (10, "offline", "offline-cocotb-example", "Run a cocotb example", None),
            (11, "wrap", "wrap", "cocotb complete", None),
        ],
    },
    "learn_formal": {
        "anchor": "18-learn_formal",
        "modules": [
            (0, "intro", "intro", "Welcome to formal", None),
            (1, "lab", "sva-timeline", "Properties on a timeline", "sva-timeline"),
            (2, "lab", "assert-assume-cover", "Assert / assume / cover", "assert-assume-cover"),
            (3, "lab", "cover-bins", "Cover vs prove intuition", "cover-bins"),
            (4, "lab", "formal-vacuity", "Vacuity", "formal-vacuity"),
            (5, "lab", "formal-bmc-bound", "BMC bound", "formal-bmc-bound"),
            (6, "lab", "formal-counterexample", "Read a counterexample", "formal-counterexample"),
            (7, "lab", "formal-induction", "Induction sketch", "formal-induction"),
            (8, "lab", "synth-lint", "Prove-friendly RTL hygiene", "synth-lint"),
            (9, "lab", "hdl-style", "Style cues for formal", "hdl-style"),
            (10, "offline", "offline-bmc-hello", "BMC hello (SymbiYosys)", None),
            (11, "wrap", "wrap", "Formal path complete", None),
        ],
    },
}


def write_modules_md(course_id: str, meta: dict) -> None:
    rows = []
    for nn, kind, slug, title, tool in meta["modules"]:
        lab = f"`{tool}`" if tool else "—"
        st = "S" if tool else "—"
        rows.append(
            f"| {nn:02d} | `{kind}` | [{title}](../module{nn:02d}-{slug}/README.md) | {lab} | {st} |"
        )
    text = (
        f"# {course_id} — module index\n\n"
        f"Lab-driven syllabus (pass 3). Full product syllabus: "
        f"[../../syllabus.md](../../syllabus.md#{meta['anchor']}).\n\n"
        f"| # | Kind | Module | Lab | Status |\n"
        f"|---|------|--------|-----|--------|\n"
        + "\n".join(rows)
        + "\n\n## Dual tracks\n\nSee [TWO_TRACKS.md](TWO_TRACKS.md).\n"
    )
    path = ROOT / "courses" / course_id / "docs" / "MODULES.md"
    path.write_text(text, encoding="utf-8", newline="\n")


def ensure_module(course_id: str, nn: int, kind: str, slug: str, title: str, tool: str | None, mods: list) -> None:
    mdir = ROOT / "courses" / course_id / f"module{nn:02d}-{slug}"
    if mdir.is_dir() and (mdir / "README.md").is_file():
        return
    mdir.mkdir(parents=True, exist_ok=True)
    i = next(i for i, m in enumerate(mods) if m[0] == nn)
    prev = mods[i - 1] if i else None
    nxt = mods[i + 1] if i + 1 < len(mods) else None
    prev_l = f"[← {prev[3]}](../module{prev[0]:02d}-{prev[2]}/README.md)" if prev else "← Start"
    next_l = f"[{nxt[3]} →](../module{nxt[0]:02d}-{nxt[2]}/README.md)" if nxt else "End →"
    kind_line = f"**Kind:** `{kind}`"
    if tool:
        kind_line += f" · Primary lab: `{tool}` · **Shipped**"
    (mdir / "README.md").write_text(
        f"# Module {nn:02d}: {title}\n\n{kind_line}\n\n"
        f"{prev_l} · [Course README](../README.md) · {next_l}\n\n"
        f"## Outcomes\n\nPractice **{title}**"
        + (f" via `{tool}`" if tool else "")
        + ".\n\n"
        f"## Tracks\n\n1. EXAMPLES.md prompts (Track A)\n2. Browser lab if shipped (Track B)\n"
        f"3. CHECKLIST.md\n\n## Media\n\n| Artifact | Path |\n|----------|------|\n"
        f"| Transcript | [transcript.md](transcript.md) |\n| Outline | [outline.yaml](outline.yaml) |\n"
        f"| Quiz | [quiz.json](quiz.json) |\n",
        encoding="utf-8",
        newline="\n",
    )
    (mdir / "CHECKLIST.md").write_text(
        "# Checklist\n\n- [ ] EXAMPLES.md\n- [ ] Browser lab (if any)\n- [ ] Can explain in one sentence\n",
        encoding="utf-8",
        newline="\n",
    )
    (mdir / "EXAMPLES.md").write_text(
        f"# Examples — {title}\n\n1. Restate the core idea.\n2. Work one example on paper or locally.\n",
        encoding="utf-8",
        newline="\n",
    )
    (mdir / "transcript.md").write_text(
        f"# Module {nn:02d} — {title}\n\nScaffold transcript for {course_id}. Expand with module-slides.\n",
        encoding="utf-8",
        newline="\n",
    )
    (mdir / "outline.yaml").write_text(
        f"title: {title}\nfooter: {course_id}\nslides:\n- type: title\n  title: {title}\n  subtitle: Scaffold\n  notes: Scaffold.\n",
        encoding="utf-8",
        newline="\n",
    )
    quiz = {
        "module": f"module{nn:02d}-{slug}",
        "title": f"{title} check",
        "passing_score": 0.67,
        "items": [
            {
                "id": "q1",
                "type": "multiple_choice",
                "prompt": f"This module is mainly about…",
                "choices": [title, "Place-and-route only", "Git only", "Nothing"],
                "answer": 0,
                "explain": title,
            },
            {
                "id": "q2",
                "type": "true_false",
                "prompt": "Browser labs replace full offline toolchains.",
                "answer": False,
                "explain": "Literacy only.",
            },
            {
                "id": "q3",
                "type": "multiple_choice",
                "prompt": "Primary practice id is…",
                "choices": [tool or slug, "vivado-only", "gds-only", "spice-only"],
                "answer": 0,
                "explain": "Lab id.",
            },
            {
                "id": "q4",
                "type": "true_false",
                "prompt": f"{course_id} follows the lab-driven pass-3 pattern.",
                "answer": True,
                "explain": "One module ≈ one lab when possible.",
            },
        ],
    }
    (mdir / "quiz.json").write_text(json.dumps(quiz, indent=2) + "\n", encoding="utf-8", newline="\n")


def patch_tools_index() -> None:
    path = ROOT / "platform" / "tools" / "index.html"
    text = path.read_text(encoding="utf-8")
    # update counts in hero
    text = re.sub(
        r"Catalog: <strong>\d+ shipped</strong>, <strong>\d+ planned</strong>",
        "Catalog: <strong>212 shipped</strong>, <strong>0 planned</strong>",
        text,
    )
    # insert python tools before closing ul of pyuvm
    py_extra = ""
    for slug, title, meta, section in NEW_TOOLS:
        if section != "pyuvm":
            continue
        py_extra += f"""        <li>
          <a href="{slug}/index.html">{title}</a>
          <div class="chapter-meta">{meta}</div>
        </li>
"""
    if "pytest-assert-lab/index.html" not in text:
        text = text.replace(
            """        <li>
          <a href="cocotb-uvm-map/index.html">cocotb vs UVM map</a>
          <div class="chapter-meta">pyuvm / cocotb ↔ SV UVM roles · 22 challenges · learn_pyuvm 04</div>
        </li>
      </ul>
    </section>

    <section class="tools-stage" id="verif-plan">""",
            f"""        <li>
          <a href="cocotb-uvm-map/index.html">cocotb vs UVM map</a>
          <div class="chapter-meta">pyuvm / cocotb ↔ SV UVM roles · 22 challenges · learn_pyuvm 04</div>
        </li>
{py_extra}      </ul>
    </section>

    <section class="tools-stage" id="formal">
      <h2>Formal verification (conceptual)</h2>
      <p class="tools-stage-note"><code>learn_formal</code> — assert/assume/cover, BMC, CEX, induction, vacuity sketches. Engines stay offline.</p>
      <ul class="chapter-list">
        <li>
          <a href="assert-assume-cover/index.html">Assert / assume / cover</a>
          <div class="chapter-meta">property roles · 22 challenges</div>
        </li>
        <li>
          <a href="formal-bmc-bound/index.html">Formal BMC bound</a>
          <div class="chapter-meta">bound k vs bugAt · 22 challenges</div>
        </li>
        <li>
          <a href="formal-counterexample/index.html">Formal counterexample</a>
          <div class="chapter-meta">step CEX wave · 22 challenges</div>
        </li>
        <li>
          <a href="formal-induction/index.html">Formal induction sketch</a>
          <div class="chapter-meta">base + step · 22 challenges</div>
        </li>
        <li>
          <a href="formal-vacuity/index.html">Formal vacuity</a>
          <div class="chapter-meta">vacuous pass · 22 challenges</div>
        </li>
      </ul>
    </section>

    <section class="tools-stage" id="verif-plan">""",
        )
    path.write_text(text, encoding="utf-8", newline="\n")
    print("patched tools/index.html")


def patch_tools_md() -> None:
    path = ROOT / "platform" / "tools.md"
    text = path.read_text(encoding="utf-8")
    starters = [
        ("`pytest-assert-lab`", "expect `0xA5` == actual → PASS"),
        ("`stim-as-data`", "4 AND vectors — Apply all PASS"),
        ("`cocotb-clock-helper`", "period 10 → edges 10/20/30"),
        ("`cocotb-binary-value`", "8-bit `0xA5` → `10100101`"),
        ("`cocotb-scoreboard`", "expect `0xA5`, observe match → PASS"),
        ("`assert-assume-cover`", "3 statements correctly tagged"),
        ("`formal-bmc-bound`", "bug@3, k=5 → CEX"),
        ("`formal-counterexample`", "cursor on failing cycle"),
        ("`formal-induction`", "base+step hold → proved sketch"),
        ("`formal-vacuity`", "`a|->b` with a always 0 → vacuous"),
    ]
    if "`pytest-assert-lab`" not in text:
        block = "\n".join(f"| {a} | {b} |" for a, b in starters) + "\n"
        text = text.replace(
            "| `python-async-tb` |",
            block + "| `python-async-tb` |",
        )
    # add formal section before verification planning if missing
    if "## Formal verification (conceptual)" not in text:
        formal_tbl = """
## Formal verification (conceptual)

Literacy for `learn_formal`. **Not** a commercial formal engine or SymbiYosys replacement.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Assert / assume / cover | `assert-assume-cover` | **Shipped** | Property roles; 22 challenges |
| Formal BMC bound | `formal-bmc-bound` | **Shipped** | Bound k vs bug depth; 22 challenges |
| Formal counterexample | `formal-counterexample` | **Shipped** | Step a short CEX; 22 challenges |
| Formal induction sketch | `formal-induction` | **Shipped** | Base + step literacy; 22 challenges |
| Formal vacuity | `formal-vacuity` | **Shipped** | Vacuous pass intuition; 22 challenges |

"""
        text = text.replace("## Verification planning (lightweight)", formal_tbl + "## Verification planning (lightweight)")

    # extend UVM/python table rows for new cocotb/python tools
    for slug, title, _, section in NEW_TOOLS:
        if section != "pyuvm":
            continue
        if f"`{slug}`" not in text.split("## UVM 2017")[1].split("## Verification")[0]:
            text = text.replace(
                "| Python async TB sketch | `python-async-tb` | **Shipped** | `async def` test + await timeline; 22 challenges |",
                "| Python async TB sketch | `python-async-tb` | **Shipped** | `async def` test + await timeline; 22 challenges |\n"
                f"| {title} | `{slug}` | **Shipped** | Gap-fill concept lab; 22 challenges |",
            )

    if "Full formal engines" not in text:
        text = text.replace(
            "- Toolchain installers and CI Make flows  ",
            "- Toolchain installers and CI Make flows  \n"
            "- Full formal engines (SymbiYosys / Jasper / VC Formal) and proof databases  ",
        )

    text = re.sub(
        r"\| Shipped \| \d+ \|",
        "| Shipped | 212 |",
        text,
    )
    text = re.sub(
        r"\| \*\*Total catalogued\*\* \| \*\*\d+\*\* \|",
        "| **Total catalogued** | **212** |",
        text,
    )

    text = text.replace(
        "| `learn_python_hw` | `python-async-tb` / `file-vector-io` (**shipped**); course scaffolded | offline venv / pytest modules |",
        "| `learn_python_hw` | `python-async-tb` / `stim-as-data` / `pytest-assert-lab` / `file-vector-io` (**shipped**); course scaffolded | offline venv / deps |",
    )
    text = text.replace(
        "| `learn_cocotb` | cocotb + async + self-check / waves (**shipped**); course scaffolded | offline cocotb example |",
        "| `learn_cocotb` | cocotb triggers/clock/DUT/BinaryValue/scoreboard + async (**shipped**); course scaffolded | offline cocotb example |",
    )
    text = text.replace(
        "| `learn_formal` | `sva-timeline` / `cover-bins` / `synth-lint` / `hdl-style` (**shipped**); course scaffolded | BMC / counterexample / induction offline |",
        "| `learn_formal` | assert/assume/cover + BMC/CEX/induction/vacuity + SVA/cover/synth (**shipped**); course scaffolded | SymbiYosys offline hello |",
    )
    text = text.replace(
        "| `learn_sv_tb` | full SV TB browser path (**all shipped**); course scaffolded | — |",
        "| `learn_sv_tb` | SV TB path + `task-vs-function` / `fork-join` (**all shipped**); course scaffolded | — |",
    )

    # cross-ref domains
    if "Formal verification" not in text.split("Cross-reference")[1].split("Course-by-course")[0]:
        text = text.replace(
            "| `learn_formal` | SVA timeline, cover vs prove, synth/style hygiene; BMC offline |",
            "| `learn_formal` | **Formal sketches**, SVA timeline, cover, synth/style; SymbiYosys offline |",
        )
        text = text.replace(
            "| `learn_python_hw` | Python async TB, file/vector I/O, offline venv/pytest |",
            "| `learn_python_hw` | Python async TB, stim-as-data, pytest-assert, file/vector I/O |",
        )
        text = text.replace(
            "| `learn_cocotb` | cocotb triggers / DUT handle, Python async TB, self-check |",
            "| `learn_cocotb` | cocotb triggers / Clock / BinaryValue / scoreboard / DUT, Python async |",
        )

    path.write_text(text, encoding="utf-8", newline="\n")
    print("patched tools.md")


def patch_catalog_tools_index() -> None:
    cat_path = ROOT / "platform" / "assets" / "catalog.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    existing = {t["id"] for t in cat.get("toolsIndex", [])}
    for slug, title, _, section in NEW_TOOLS:
        if slug in existing:
            continue
        sec = (
            "Formal verification"
            if section == "formal"
            else "Python / cocotb / pyuvm"
        )
        cat.setdefault("toolsIndex", []).append(
            {"id": slug, "title": title, "section": sec}
        )
    cat_path.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("catalog toolsIndex +=", len(NEW_TOOLS))


def main() -> None:
    for course_id, meta in COURSE_MODULES.items():
        write_modules_md(course_id, meta)
        for m in meta["modules"]:
            ensure_module(course_id, m[0], m[1], m[2], m[3], m[4], meta["modules"])
        print(course_id, "modules", len(meta["modules"]))
    patch_tools_index()
    patch_tools_md()
    patch_catalog_tools_index()


if __name__ == "__main__":
    main()
