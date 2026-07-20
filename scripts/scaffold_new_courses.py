#!/usr/bin/env python3
"""Scaffold learn_python_hw, learn_sv_tb, learn_cocotb, learn_formal under courses/."""
from __future__ import annotations

import json
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / "courses"

LICENSE = """\
Creative Commons Attribution 4.0 International (CC BY 4.0)

Copyright (c) The {course_id} contributors.

This work is licensed under the Creative Commons Attribution 4.0 International
License. To view a copy of this license, visit:
  https://creativecommons.org/licenses/by/4.0/

or send a letter to:
  Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.

================================================================================
You are free to:
  - Share — copy and redistribute the material in any medium or format for any
    purpose, even commercially.
  - Adapt — remix, transform, and build upon the material for any purpose, even
    commercially.

The licensor cannot revoke these freedoms as long as you follow the license terms.

Under the following terms:
  - Attribution — You must give appropriate credit, provide a link to the
    license, and indicate if changes were made. You may do so in any reasonable
    manner, but not in any way that suggests the licensor endorses you or your use.

No additional restrictions — You may not apply legal terms or technological
measures that legally restrict others from doing anything the license permits.

================================================================================
Full legal code: https://creativecommons.org/licenses/by/4.0/legalcode
"""

MODULE_SH = r'''#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NN="${1:-}"
shift || true
if [[ -z "$NN" || "$NN" == "--help" ]]; then
  echo "Usage: $0 NN [--check|--demo|--help]"
  exit 0
fi
NN="$(printf '%02d' "$((10#$NN))")"
MOD_DIR="$(find "$ROOT" -maxdepth 1 -type d -name "module${NN}-*" | head -1)"
if [[ -z "$MOD_DIR" ]]; then
  echo "No module directory for $NN"
  exit 1
fi
ACTION="${1:---check}"
case "$ACTION" in
  --check)
    echo "Module $NN self-check (Track A environment)"
    echo "Module dir: $MOD_DIR"
    command -v bash >/dev/null && echo "[OK] bash"
    if command -v python3 >/dev/null 2>&1; then
      echo "[OK] python3"
    elif command -v python >/dev/null 2>&1; then
      echo "[OK] python"
    else
      echo "[INFO] python not on PATH (optional for this course)"
    fi
    [[ -f "$MOD_DIR/EXAMPLES.md" ]] && echo "[OK] EXAMPLES.md"
    [[ -f "$MOD_DIR/CHECKLIST.md" ]] && echo "[OK] CHECKLIST.md"
    ;;
  --demo)
    echo "Demo: open $MOD_DIR/EXAMPLES.md and README.md"
    ;;
  *)
    echo "Unknown option: $ACTION"
    exit 1
    ;;
esac
'''

# Each module: (nn, kind, slug, title, tool_id|None, status "S"|None)
# kind: intro | lab | bridge | offline | wrap

COURSES_SPEC: dict[str, dict] = {
    "learn_python_hw": {
        "title": "Python for hardware",
        "focus": "Python on-ramp for HW verification (before cocotb)",
        "prereq": "Unix helpful",
        "domain": "Python%20%7C%20HW%20verification%20on-ramp",
        "goal": "Python literacy for hardware verification — env, async, vectors — before cocotb.",
        "track_a": "Local Python (venv, scripts, pytest)",
        "track_b": "Browser labs (`python-async-tb`, `file-vector-io`)",
        "next_courses": ["learn_cocotb", "learn_pyuvm"],
        "syllabus_anchor": "15-learn_python_hw",
        "modules": [
            (0, "intro", "intro", "Welcome to Python for hardware", None, None),
            (1, "lab", "python-async-tb", "Python async TB", "python-async-tb", "S"),
            (2, "offline", "offline-venv-pip", "venv + pip for HW tools", None, None),
            (3, "lab", "file-vector-io", "Stimulus as data / vectors", "file-vector-io", "S"),
            (4, "offline", "offline-pytest-golden", "pytest + golden asserts", None, None),
            (5, "bridge", "why-async-sim", "Why async fits simulation", None, None),
            (6, "offline", "offline-hello-deps", "Install preview (cocotb deps)", None, None),
            (7, "wrap", "wrap", "Python-for-HW complete", None, None),
        ],
    },
    "learn_sv_tb": {
        "title": "SystemVerilog testbench",
        "focus": "Directed TB → CRV → SVA → cover (before UVM)",
        "prereq": "learn_systemverilog",
        "domain": "SV%20TB%20%7C%20SVA%20%7C%20CRV",
        "goal": "Directed SystemVerilog testbench literacy — self-check, classes, CRV, cover, SVA — before UVM.",
        "track_a": "Local SV TB sketches (iverilog / Verilator / HDL Simulator)",
        "track_b": "Browser SV TB & assertion sketches",
        "next_courses": ["learn_uvm2017", "learn_formal"],
        "syllabus_anchor": "16-learn_sv_tb",
        "modules": [
            (0, "intro", "intro", "Welcome to SV testbench", None, None),
            (1, "lab", "tb-anatomy", "TB anatomy", "tb-anatomy", "S"),
            (2, "lab", "self-check-tb", "Self-checking TB", "self-check-tb", "S"),
            (3, "lab", "tb-clock-reset", "Clock + reset patterns", "tb-clock-reset", "S"),
            (4, "lab", "file-vector-io", "File / vector I/O", "file-vector-io", "S"),
            (5, "lab", "vif-wiring", "Virtual interface wiring", "vif-wiring", "S"),
            (6, "lab", "sv-class-sketch", "Class / inheritance sketch", "sv-class-sketch", "S"),
            (7, "lab", "crv-lite", "Constraint / random lite", "crv-lite", "S"),
            (8, "lab", "cover-bins", "Coverpoint / bins", "cover-bins", "S"),
            (9, "lab", "sva-timeline", "SVA implication timeline", "sva-timeline", "S"),
            (10, "lab", "tb-vs-uvm-map", "TB vs UVM map", "tb-vs-uvm-map", "S"),
            (11, "wrap", "wrap", "SV TB complete", None, None),
        ],
    },
    "learn_cocotb": {
        "title": "cocotb",
        "focus": "cocotb triggers → DUT handle → self-check (before pyuvm)",
        "prereq": "learn_python_hw recommended; Verilog + sim",
        "domain": "cocotb%20%7C%20Python%20TB",
        "goal": "cocotb as a Python testbench — triggers, DUT handles, self-check — before pyuvm methodology.",
        "track_a": "Real cocotb + simulator (Verilator / iverilog)",
        "track_b": "Browser cocotb / async TB sketches",
        "next_courses": ["learn_pyuvm", "learn_verification_planning_management"],
        "syllabus_anchor": "17-learn_cocotb",
        "modules": [
            (0, "intro", "intro", "Welcome to cocotb", None, None),
            (1, "lab", "python-async-tb", "Python async TB", "python-async-tb", "S"),
            (2, "lab", "cocotb-triggers", "cocotb triggers", "cocotb-triggers", "S"),
            (3, "lab", "cocotb-dut-handle", "cocotb DUT handle", "cocotb-dut-handle", "S"),
            (4, "lab", "cocotb-uvm-map", "cocotb ↔ UVM roles", "cocotb-uvm-map", "S"),
            (5, "lab", "self-check-tb", "Self-check pattern", "self-check-tb", "S"),
            (6, "lab", "tb-clock-reset", "Clock + reset in TB", "tb-clock-reset", "S"),
            (7, "lab", "waveform-lab", "Waves literacy", "waveform-lab", "S"),
            (8, "offline", "offline-cocotb-example", "Run a cocotb example", None, None),
            (9, "wrap", "wrap", "cocotb complete", None, None),
        ],
    },
    "learn_formal": {
        "title": "Formal verification intro",
        "focus": "Assert / assume / cover → BMC → counterexample (literacy)",
        "prereq": "learn_sv_tb or SVA lite; Verilog",
        "domain": "formal%20%7C%20SVA%20%7C%20BMC",
        "goal": "Formal verification literacy — properties, cover vs prove, BMC / counterexamples — not a full commercial formal flow.",
        "track_a": "Local SymbiYosys / Yosys (or other) + property sketches",
        "track_b": "Browser SVA / cover / synth hygiene sketches",
        "next_courses": ["learn_verification_planning_management", "learn_uvm2017"],
        "syllabus_anchor": "18-learn_formal",
        "modules": [
            (0, "intro", "intro", "Welcome to formal", None, None),
            (1, "lab", "sva-timeline", "Properties on a timeline", "sva-timeline", "S"),
            (2, "lab", "cover-bins", "Cover vs prove intuition", "cover-bins", "S"),
            (3, "bridge", "assert-assume-cover", "Assert / assume / cover", None, None),
            (4, "lab", "synth-lint", "Prove-friendly RTL hygiene", "synth-lint", "S"),
            (5, "lab", "hdl-style", "Style cues for formal", "hdl-style", "S"),
            (6, "offline", "offline-bmc-hello", "BMC hello (SymbiYosys)", None, None),
            (7, "offline", "offline-counterexample", "Read a counterexample", None, None),
            (8, "offline", "offline-induction-sketch", "Induction sketch", None, None),
            (9, "wrap", "wrap", "Formal path complete", None, None),
        ],
    },
}


def mod_dir_name(nn: int, slug: str) -> str:
    return f"module{nn:02d}-{slug}"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.replace("\r\n", "\n"), encoding="utf-8")


def quiz_for(course_id: str, nn: int, slug: str, title: str, tool_id: str | None) -> dict:
    topic = tool_id or slug
    return {
        "module": mod_dir_name(nn, slug),
        "title": f"{title} check",
        "passing_score": 0.67,
        "items": [
            {
                "id": "q1",
                "type": "multiple_choice",
                "prompt": f"This module in {course_id} is mainly about…",
                "choices": [
                    title,
                    "Place-and-route only",
                    "Git remotes only",
                    "Writing a commercial VIP",
                ],
                "answer": 0,
                "explain": f"Focus: {title}.",
            },
            {
                "id": "q2",
                "type": "multiple_choice",
                "prompt": "Track B practice is typically…",
                "choices": [
                    "Browser concept labs on the learning platform",
                    "Only Vivado GUI tutorials",
                    "Skipping all checklists",
                    "Uploading RTL to a grading server",
                ],
                "answer": 0,
                "explain": "Track B is in-browser literacy.",
            },
            {
                "id": "q3",
                "type": "multiple_choice",
                "prompt": f"Primary practice surface for this module is…",
                "choices": [
                    topic,
                    "Only PowerPoint",
                    "Only synthesis P&R",
                    "Only GitHub Issues",
                ],
                "answer": 0,
                "explain": f"Lab / activity id: {topic}.",
            },
            {
                "id": "q4",
                "type": "true_false",
                "prompt": "Browser concept labs replace a full offline toolchain for this course.",
                "answer": False,
                "explain": "Labs are literacy; Track A / offline keeps fidelity.",
            },
        ],
    }


def outline_yaml(course_id: str, title: str, tool_id: str | None) -> str:
    lab = tool_id or "offline / bridge"
    return textwrap.dedent(
        f"""\
        title: {title}
        footer: {course_id} — {title.lower()}
        slides:
        - type: title
          title: {title}
          subtitle: Scaffold module — expand with module-slides when recording
          notes: Welcome to {title}. This is a scaffold transcript for {course_id}.
        - type: bullets
          title: What you practice
          bullets:
          - Primary surface - {lab}
          - Track A - local / offline practice
          - Track B - browser lab when shipped
          notes: Practice both tracks when you can. Browser labs build intuition; offline builds fidelity.
        - type: bullets
          title: Your turn
          bullets:
          - Open EXAMPLES.md and work one prompt
          - Open the browser lab if this module has a tool id
          - Check off CHECKLIST.md
          notes: Complete the checklist for at least one track, then take the short quiz.
        """
    )


def transcript_md(course_id: str, nn: int, slug: str, title: str, tool_id: str | None, kind: str) -> str:
    lab = tool_id or kind
    return textwrap.dedent(
        f"""\
        # Module {nn:02d} — {title}

        **Module id:** {mod_dir_name(nn, slug)}
        **Kind:** {kind} · **Primary:** {lab}
        **Tracks:** A (local / offline) · B (browser lab when applicable)

        ## Slide 1 — {title}

        This module is part of **{course_id}**. The goal is literacy you can reuse in a real toolchain — not a full commercial flow in the browser.

        ## Slide 2 — What you practice

        Primary surface: **{lab}**. Track A uses local tools and EXAMPLES.md prompts. Track B uses the shipped browser lab when this module has a tool id.

        ## Slide 3 — Your turn

        Work one EXAMPLES prompt, open the lab if shipped, and check off CHECKLIST.md. Then take the short quiz and continue to the next module.
        """
    )


def checklist_md(kind: str, tool_id: str | None) -> str:
    if kind in ("intro", "wrap", "bridge"):
        return textwrap.dedent(
            f"""\
            # Checklist

            - [ ] Read the module README
            - [ ] Skim EXAMPLES.md (if present)
            - [ ] I can state this module's job in one sentence
            """
        )
    if kind == "offline":
        return textwrap.dedent(
            """\
            # Checklist — offline

            ## Track A — Local toolchain

            - [ ] Worked through at least one prompt in EXAMPLES.md
            - [ ] Ran `./scripts/module.sh NN --check` (optional)

            ## Done when

            - [ ] I can repeat the offline steps without the README open
            """
        )
    return textwrap.dedent(
        f"""\
        # Checklist

        ## Track A — Local / offline

        - [ ] Worked through at least one prompt in EXAMPLES.md
        - [ ] Can explain the outcome in my own words

        ## Track B — Browser lab (`{tool_id or "—"}`)

        - [ ] Opened the lab (local or live) **or** noted N/A for this module
        - [ ] If shipped: loaded starter + completed a few challenges

        ## Done when

        - [ ] I can do the task offline **or** I finished the browser challenges (preferably both when shipped)
        """
    )


def examples_md(course_id: str, title: str, tool_id: str | None, kind: str) -> str:
    if tool_id:
        return textwrap.dedent(
            f"""\
            # Examples — {title}

            Track A prompts. Browser lab **`{tool_id}`** is shipped.

            ## Prompts

            1. Restate the core idea of **{title}** in one sentence.
            2. Sketch one worked example on paper (or in a tiny script / HDL file).
            3. Optional: map the same idea to a real cocotb / SV / formal tool you already use.

            ## Stretch

            Redo the same idea in the **`{tool_id}`** starter challenges.
            """
        )
    return textwrap.dedent(
        f"""\
        # Examples — {title}

        Track A / offline prompts for **{course_id}**.

        ## Prompts

        1. Restate why this **{kind}** module exists in the course path.
        2. Write the commands or property sketch you would run locally.
        3. Note one pitfall (env, false pass, vacuity, …) to watch for.
        """
    )


def module_readme(
    course_id: str,
    nn: int,
    kind: str,
    slug: str,
    title: str,
    tool_id: str | None,
    status: str | None,
    prev: tuple | None,
    nxt: tuple | None,
    spec: dict,
) -> str:
    prev_link = (
        f"[← {prev[3]}](../{mod_dir_name(prev[0], prev[2])}/README.md)"
        if prev
        else "← Start"
    )
    next_link = (
        f"[{nxt[3]} →](../{mod_dir_name(nxt[0], nxt[2])}/README.md)"
        if nxt
        else "End →"
    )
    status_bit = f" · **Shipped**" if status == "S" and tool_id else ""
    kind_line = f"**Kind:** `{kind}`"
    if tool_id:
        kind_line += f" · Primary lab: `{tool_id}`{status_bit}"

    if kind == "intro":
        body = textwrap.dedent(
            f"""\
            ## What this course is

            **{course_id}** — {spec['goal']}

            | Track | Where you practice | Best for |
            |-------|--------------------|----------|
            | **A** | {spec['track_a']} | Muscle memory you keep |
            | **B** | {spec['track_b']} | Fast intuition |

            Next after this course: {', '.join(f'**{c}**' for c in spec['next_courses'])}.

            ## Setup (Track A)

            1. Install the local tools named in [docs/TWO_TRACKS.md](../docs/TWO_TRACKS.md).
            2. Open this repo at `courses/{course_id}`.

            ## Setup (Track B)

            1. Serve the platform: `python -m http.server 8080 --directory platform` (from monorepo root).
            2. Open http://127.0.0.1:8080/tools/index.html
            3. Live: [learning/tools](https://universal-verification-methodology.github.io/learning/tools/).

            ## How to move through modules

            1. Read the module **README** (outcomes).
            2. Pick Track A, Track B, or both.
            3. Check off **CHECKLIST.md**.
            4. Optional: expand `transcript.md` / `outline.yaml` with **module-slides** in the parent monorepo.
            """
        )
    elif kind == "wrap":
        body = textwrap.dedent(
            f"""\
            ## You can now

            - Explain the core ideas of **{course_id}** in your own words
            - Point at the shipped browser labs you used (if any)
            - Know what to open next: {', '.join(f'**{c}**' for c in spec['next_courses'])}

            ## Dual-track recap

            If you mainly used browser labs, revisit any offline modules on Track A.  
            If you mainly used Track A, open the shipped labs for visual challenges.

            ## Next courses

            → {' · '.join(f'**{c}**' for c in spec['next_courses'])}  
            Syllabus: [../../syllabus.md](../../syllabus.md#{spec['syllabus_anchor']})
            """
        )
    elif kind == "offline":
        body = textwrap.dedent(
            f"""\
            ## Outcomes

            After this module you can run the **offline** activity for **{title}** on your machine.

            ## Track A — Local toolchain

            1. Open [EXAMPLES.md](EXAMPLES.md) and work the prompts.
            2. Complete [CHECKLIST.md](CHECKLIST.md).
            3. Optional self-check: `./scripts/module.sh {nn:02d} --check` (from course root).

            > Browser labs do not replace this offline step — fidelity stays local.
            """
        )
    elif kind == "bridge":
        body = textwrap.dedent(
            f"""\
            ## Outcomes

            After this **bridge** module you can connect the previous and next labs without a new primary tool.

            ## Practice

            1. Open [EXAMPLES.md](EXAMPLES.md) and answer the prompts in your notes.
            2. Complete [CHECKLIST.md](CHECKLIST.md).
            """
        )
    else:
        local = "http://127.0.0.1:8080/tools/" + (tool_id or "") + "/index.html"
        live = "https://universal-verification-methodology.github.io/learning/tools/" + (tool_id or "") + "/"
        body = textwrap.dedent(
            f"""\
            ## Outcomes

            After this module you can explain and practice **{title}** (`{tool_id}`), in the browser and/or offline.

            ## Two tracks (pick one or both)

            ### Track A — Local / offline

            1. Open [EXAMPLES.md](EXAMPLES.md) and work the prompts.
            2. Complete [CHECKLIST.md](CHECKLIST.md).
            3. Optional self-check: `./scripts/module.sh {nn:02d} --check` (from course root).

            ### Track B — Browser lab (online)

            1. Local: [{local}]({local})
            2. Live: [{live}]({live})
            3. Load the **starter example**, then work challenges.
            4. Check off the Track B items in [CHECKLIST.md](CHECKLIST.md).

            > Concept labs are literacy tools — they do not replace a full offline toolchain.
            """
        )

    media = textwrap.dedent(
        """\
        ## Media

        | Artifact | Path |
        |----------|------|
        | Transcript | [transcript.md](transcript.md) |
        | Outline | [outline.yaml](outline.yaml) |
        | Slides | [slides.pptx](slides.pptx) · [slides.pdf](slides.pdf) |
        | Video | [video.mp4](video.mp4) |
        | Quiz | [quiz.json](quiz.json) |
        """
    )

    files = textwrap.dedent(
        f"""\
        ## Files

        ```
        {mod_dir_name(nn, slug)}/
        ├── README.md
        ├── CHECKLIST.md
        ├── EXAMPLES.md
        ├── outline.yaml
        ├── transcript.md
        └── quiz.json
        ```
        """
    )

    next_section = f"\n## Next\n\n→ {next_link}\n" if kind != "wrap" else ""

    return (
        f"# Module {nn:02d}: {title}\n\n"
        f"{kind_line}\n\n"
        f"{prev_link} · [Course README](../README.md) · {next_link}\n\n"
        f"{body}\n"
        f"{media}\n"
        f"{files}"
        f"{next_section}"
    )


def course_readme(course_id: str, spec: dict) -> str:
    mods = spec["modules"]
    last_nn = mods[-1][0]
    tree_lines = [
        f"{course_id}/",
        "├── README.md",
        "├── LICENSE",
        "├── docs/",
        "│   ├── MODULES.md",
        "│   └── TWO_TRACKS.md",
        "├── scripts/",
        "│   └── module.sh",
    ]
    for i, (nn, _k, slug, _t, _tool, _s) in enumerate(mods):
        prefix = "└──" if i == len(mods) - 1 else "├──"
        tree_lines.append(f"{prefix} {mod_dir_name(nn, slug)}/")
    tree = "\n".join(tree_lines)

    landings = "\n".join(
        f"| {nn:02d} — {title} | [{mod_dir_name(nn, slug)}]({mod_dir_name(nn, slug)}/README.md) |"
        for nn, _k, slug, title, _tool, _s in mods
    )

    shipped = [t for _n, k, _s, _t, t, st in mods if k == "lab" and t and st == "S"]
    lab_links = " · ".join(
        f"[{t}](https://universal-verification-methodology.github.io/learning/tools/{t}/)"
        for t in shipped
    )

    return textwrap.dedent(
        f"""\
        # {course_id}

        [![GitHub](https://img.shields.io/badge/GitHub-{course_id.replace('_', '__')}-181717?logo=github)](https://github.com/universal-verification-methodology/{course_id})
        [![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](LICENSE)
        [![Role](https://img.shields.io/badge/role-course%20scaffold-orange)](https://github.com/universal-verification-methodology/learning)
        [![Parent](https://img.shields.io/badge/parent-learning%20monorepo-0A9EDC)](https://github.com/universal-verification-methodology/learning)
        [![Labs](https://img.shields.io/badge/labs-GitHub%20Pages-222?logo=githubpages)](https://universal-verification-methodology.github.io/learning/tools/)
        [![Domain](https://img.shields.io/badge/domain-{spec['domain']}-purple)](https://github.com/universal-verification-methodology/{course_id})

        **{course_id}** is the open learning path for *{spec['focus']}*.

        Authors rebuild slides/audio with **module-slides** in the parent monorepo.

        ## Table of contents

        - [Contents](#contents)
        - [Browse or clone](#browse-or-clone)
        - [Author: module-slides](#author-module-slides)
        - [Two learning tracks](#two-learning-tracks)
        - [Module landings](#module-landings)
        - [Browser labs](#browser-labs)
        - [License](#license)

        ## Contents

        ```text
        {tree}
        ```

        ## Browse or clone

        - **Browser labs:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)
        - **Syllabus:** [`syllabus.md` § {course_id}](https://github.com/universal-verification-methodology/learning/blob/main/syllabus.md#{spec['syllabus_anchor']})

        ```bash
        git clone --recurse-submodules \\
          git@github.com:universal-verification-methodology/learning.git
        ls courses/{course_id}
        ./scripts/module.sh 01 --check
        ```

        ## Author: module-slides

        ```bash
        cd ../..   # monorepo root
        python .cursor/skills/module-slides/scripts/transcript_to_outline.py \\
          courses/{course_id}/module01-{mods[1][2]}
        bash .cursor/skills/module-slides/scripts/narrate_clips.sh \\
          courses/{course_id}/module01-{mods[1][2]}
        ```

        ## Two learning tracks

        Details: [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md).

        | Track | Practice surface | Start here |
        |-------|------------------|------------|
        | **A** | {spec['track_a']} | [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md) |
        | **B** | {spec['track_b']} | [tools index](https://universal-verification-methodology.github.io/learning/tools/) |

        ## Module landings

        Full status table: **[docs/MODULES.md](docs/MODULES.md)**.

        | Module | Landing |
        |--------|---------|
        {landings}

        ## Browser labs

        **Shipped:** {lab_links or "— (offline / bridge heavy course)"}.

        ## License

        [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see [`LICENSE`](LICENSE).
        """
    )


def modules_md(course_id: str, spec: dict) -> str:
    rows = []
    for nn, kind, slug, title, tool, status in spec["modules"]:
        lab = f"`{tool}`" if tool else "—"
        st = status or "—"
        rows.append(
            f"| {nn:02d} | `{kind}` | [{title}](../{mod_dir_name(nn, slug)}/README.md) | {lab} | {st} |"
        )
    table = "\n".join(rows)
    return (
        f"# {course_id} — module index\n\n"
        f"Lab-driven syllabus (pass 3). Full product syllabus: "
        f"[../../syllabus.md](../../syllabus.md#{spec['syllabus_anchor']}).\n\n"
        f"| # | Kind | Module | Lab | Status |\n"
        f"|---|------|--------|-----|--------|\n"
        f"{table}\n\n"
        f"## Dual tracks\n\n"
        f"See [TWO_TRACKS.md](TWO_TRACKS.md).\n"
    )


def two_tracks_md(course_id: str, spec: dict) -> str:
    shipped = [t for _n, k, _s, _t, t, st in spec["modules"] if k == "lab" and t and st == "S"]
    labs = ", ".join(f"`{t}`" for t in shipped) or "(none yet — offline / bridge)"
    return (
        f"# Two learning tracks\n\n"
        f"## Track A — Local / offline\n\n"
        f"Practice with {spec['track_a']}.\n\n"
        f"- Prompts under each `moduleNN-*/EXAMPLES.md`\n"
        f"- Self-check: `./scripts/module.sh NN --check`\n\n"
        f"## Track B — Browser lab\n\n"
        f"- Local tools: http://127.0.0.1:8080/tools/\n"
        f"- Live: https://universal-verification-methodology.github.io/learning/tools/\n"
        f"- **Shipped today:** {labs}\n\n"
        f"## Recommended path\n\n"
        f"1. Intro\n"
        f"2. Lab modules in order (Track B when shipped)\n"
        f"3. Offline modules on Track A\n"
        f"4. Wrap → {', '.join(spec['next_courses'])}\n"
    )


def scaffold_course(course_id: str, spec: dict) -> None:
    root = COURSES / course_id
    root.mkdir(parents=True, exist_ok=True)
    write(root / "LICENSE", LICENSE.format(course_id=course_id))
    write(root / "README.md", course_readme(course_id, spec))
    write(root / "docs" / "MODULES.md", modules_md(course_id, spec))
    write(root / "docs" / "TWO_TRACKS.md", two_tracks_md(course_id, spec))
    sh = root / "scripts" / "module.sh"
    write(sh, MODULE_SH)
    # best-effort executable bit on Unix; no-op on Windows
    try:
        sh.chmod(sh.stat().st_mode | 0o111)
    except OSError:
        pass

    mods = spec["modules"]
    for i, mod in enumerate(mods):
        nn, kind, slug, title, tool, status = mod
        prev = mods[i - 1] if i else None
        nxt = mods[i + 1] if i + 1 < len(mods) else None
        mdir = root / mod_dir_name(nn, slug)
        write(
            mdir / "README.md",
            module_readme(course_id, nn, kind, slug, title, tool, status, prev, nxt, spec),
        )
        write(mdir / "CHECKLIST.md", checklist_md(kind, tool))
        write(mdir / "EXAMPLES.md", examples_md(course_id, title, tool, kind))
        write(mdir / "transcript.md", transcript_md(course_id, nn, slug, title, tool, kind))
        write(mdir / "outline.yaml", outline_yaml(course_id, title, tool))
        write(
            mdir / "quiz.json",
            json.dumps(quiz_for(course_id, nn, slug, title, tool), indent=2) + "\n",
        )


def catalog_course_entry(course_id: str, spec: dict) -> dict:
    labs = []
    for nn, kind, slug, title, tool, status in spec["modules"]:
        labs.append(
            {
                "n": f"{nn:02d}",
                "slug": slug,
                "kind": kind,
                "title": title,
                "toolId": tool,
                "status": "shipped",
            }
        )
    return {
        "id": course_id,
        "title": spec["title"],
        "focus": spec["focus"],
        "prereq": spec["prereq"],
        "status": "ready",
        "repo": course_id,
        "labs": labs,
    }


def main() -> None:
    catalog_entries = []
    for course_id, spec in COURSES_SPEC.items():
        print(f"Scaffolding {course_id} …")
        scaffold_course(course_id, spec)
        catalog_entries.append(catalog_course_entry(course_id, spec))
    out = ROOT / "scripts" / "_new_courses_catalog_fragment.json"
    write(out, json.dumps(catalog_entries, indent=2) + "\n")
    print(f"Wrote catalog fragment -> {out}")


if __name__ == "__main__":
    main()
