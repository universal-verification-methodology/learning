#!/usr/bin/env python3
"""Scaffold courses/learn_verilog from syllabus (lab-driven + dual tracks)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # courses/learn_verilog
COURSES = ROOT.parent
DST = ROOT

LAB_BASE_LOCAL = "http://127.0.0.1:8080/tools"
LAB_BASE_LIVE = "https://universal-verification-methodology.github.io/learning/tools"

# (num, slug, kind, title, lab_id|None, status S|P|None)
# All primary labs audited shipped under platform/tools/ (2026-07).
MODULES = [
    (0, "intro", "intro", "Welcome to Verilog RTL", None, None),
    (1, "module-diagram", "lab", "Module / port diagram", "module-diagram", "S"),
    (2, "verilog-literals", "lab", "Verilog literals", "verilog-literals", "S"),
    (3, "wire-vs-reg", "lab", "wire vs reg", "wire-vs-reg", "S"),
    (4, "ansi-ports", "lab", "ANSI vs non-ANSI ports", "ansi-ports", "S"),
    (5, "sv-operators", "lab", "Operators", "sv-operators", "S"),
    (6, "sensitivity-list", "lab", "Sensitivity lists", "sensitivity-list", "S"),
    (7, "latch-risk", "lab", "Latch risk", "latch-risk", "S"),
    (8, "blocking-vs-nonblocking", "lab", "Blocking vs non-blocking", "blocking-vs-nonblocking", "S"),
    (9, "param-width", "lab", "Parameter / width", "param-width", "S"),
    (10, "named-vs-positional", "lab", "Named vs positional", "named-vs-positional", "S"),
    (11, "localparam-lab", "lab", "localparam", "localparam-lab", "S"),
    (12, "sv-generate", "lab", "Generate / replication", "sv-generate", "S"),
    (13, "one-driver", "lab", "One-driver nets", "one-driver", "S"),
    (14, "counter-lab", "lab", "Counter patterns", "counter-lab", "S"),
    (15, "shift-register-lab", "lab", "Shift-register patterns", "shift-register-lab", "S"),
    (16, "synth-lint", "lab", "Synthesizability lint", "synth-lint", "S"),
    (17, "hdl-style", "lab", "HDL style", "hdl-style", "S"),
    (18, "fsm-datapath-bridge", "bridge", "FSM & datapath in RTL", None, None),
    (19, "wrap", "wrap", "Verilog complete → SV or simulators", None, None),
]


def mod_dir(num: int, slug: str) -> Path:
    return DST / f"module{num:02d}-{slug}"


def lab_urls(lab_id: str) -> tuple[str, str]:
    return (f"{LAB_BASE_LOCAL}/{lab_id}/index.html", f"{LAB_BASE_LIVE}/{lab_id}/")


def write_module_readme(
    num: int, slug: str, kind: str, title: str, lab_id: str | None, status: str | None
) -> None:
    d = mod_dir(num, slug)
    d.mkdir(parents=True, exist_ok=True)
    nn = f"{num:02d}"
    prev = next((m for m in MODULES if m[0] == num - 1), None)
    nxt = next((m for m in MODULES if m[0] == num + 1), None)

    nav = []
    if prev:
        nav.append(f"[← {prev[3]}](../module{prev[0]:02d}-{prev[1]}/README.md)")
    else:
        nav.append("← Start")
    nav.append("[Course README](../README.md)")
    if nxt:
        nav.append(f"[{nxt[3]} →](../module{nxt[0]:02d}-{nxt[1]}/README.md)")
    else:
        nav.append("End →")
    nav_line = " · ".join(nav)

    if kind == "intro":
        body = f"""# Module {nn}: {title}

**Kind:** `intro` · Dual-track course welcome

{nav_line}

## What this course is

**learn_verilog** teaches RTL coding in the **IEEE 1364** family using two modes on every lab module:

| Track | Where you practice | Best for |
|-------|--------------------|----------|
| **A — Real Verilog** | Local editor + optional iverilog / browser HDL simulator | Muscle memory, synthesizable sketches you keep |
| **B — Browser lab** | Interactive lab on the learning platform | Concept literacy, instant feedback |

You can do **A only**, **B only**, or **both** (recommended: B for intuition, then A for a tiny `.v` sketch).

Prereq comfort: **learn_digital** concepts. Next: **learn_systemverilog** or simulator courses. Legacy: [`../learn_verilog_systemverilog/`](../learn_verilog_systemverilog/) · [`../learn_digital_verilog/`](../learn_digital_verilog/).

## Setup (Track A)

1. Text editor for `.v` files (VS Code / Cursor / vim).
2. Optional: local `iverilog`/`vvp`, or the [HDL Simulator](https://universal-verification-methodology.github.io/systemverilog-simulator/).
3. Open this repo at `courses/learn_verilog`.

## Setup (Track B)

1. Serve the platform: `python -m http.server 8080 --directory platform` (from monorepo root).
2. Open http://127.0.0.1:8080/tools/index.html
3. Or use the live site: {LAB_BASE_LIVE}/

## How to move through modules

1. Read the module **README** (outcomes).
2. Pick a track (or both).
3. Check off **CHECKLIST.md**.
4. Optional: skim `outline.yaml` / `transcript.md` for upcoming slides & clips.

## Media (planned)

| Artifact | Path |
|----------|------|
| Outline | [outline.yaml](outline.yaml) |
| Transcript stub | [transcript.md](transcript.md) |
| Slides / video | generate later with **module-slides** |

## Next

→ [Module 01: Module / port diagram](../module01-module-diagram/README.md)
"""
    elif kind == "wrap":
        body = f"""# Module {nn}: {title}

**Kind:** `wrap`

{nav_line}

## You can now

- Sketch modules, ports, literals, and `wire`/`reg` correctly for 1364-style RTL
- Avoid latch risk, sensitivity bugs, and NBA/`=` mixups
- Parameterize widths, generate instances, and keep one driver per net
- Run style / synthesizability checks before pushing RTL

## Dual-track recap

If you mainly used **browser labs**, write one small `.v` for modules 01, 07–08, and 14–17.  
If you mainly used **real Verilog**, skim any skipped browser labs for interactive challenges.

## Next courses

→ **learn_systemverilog** (design constructs) · **learn_iverilog** / **learn_verilator** / **learn_hdl_simulator**  
Syllabus ladder: [../../syllabus.md](../../syllabus.md#suggested-learning-ladder)

## Checklist

- [ ] I completed Track A and/or Track B for the lab modules I care about
- [ ] I can explain wire vs reg and blocking vs non-blocking without guessing
- [ ] I know where style/synth lint lives in the tools index
"""
    elif kind == "bridge":
        body = f"""# Module {nn}: {title}

**Kind:** `bridge` · No new primary lab (reuse prior concept labs as coding practice)

{nav_line}

## Outcomes

Connect **learn_digital** FSM / datapath / memory ideas to **Verilog coding practice** — clips and sketches only; no new browser lab id.

## Practice (both tracks)

Reuse these shipped labs as “code along” prompts (open UI, then write a matching `.v` sketch):

| Concept | Lab |
|---------|-----|
| FSM | [`fsm-lab`]({LAB_BASE_LOCAL}/fsm-lab/index.html) |
| ALU / datapath | [`alu-explorer`]({LAB_BASE_LOCAL}/alu-explorer/index.html) |
| Memory map | [`mem-map`]({LAB_BASE_LOCAL}/mem-map/index.html) |

1. Pick one lab, load the starter, note the behavior.
2. Write a minimal Verilog module that could implement the same idea (even if incomplete).
3. Optional: run through iverilog or the browser HDL simulator.

## Media (planned)

| Artifact | Path |
|----------|------|
| Outline | [outline.yaml](outline.yaml) |
| Transcript stub | [transcript.md](transcript.md) |
| Slides / video | bridge clip only (module-slides) |

## Next

→ [Module 19 wrap](../module19-wrap/README.md)
"""
    else:
        assert lab_id and status
        local, live = lab_urls(lab_id)
        status_note = (
            "Shipped"
            if status == "S"
            else "Planned (Coming soon on tools index — use Track A until it ships)"
        )
        body = f"""# Module {nn}: {title}

**Kind:** `lab` · Primary lab: `{lab_id}` · **{status_note}**

{nav_line}

## Outcomes

After this module you can explain and practice the ideas taught by **`{lab_id}`**, in the browser and/or with real Verilog.

## Two tracks (pick one or both)

### Track A — Real Verilog (hands-on)

1. Open [EXAMPLES.md](EXAMPLES.md) and write / edit the suggested sketch.
2. Complete [CHECKLIST.md](CHECKLIST.md) in a local `.v` file (iverilog optional).
3. Optional self-check: `./scripts/module.sh {nn} --check` (from course root).

### Track B — Browser lab (online)

1. Local: [{local}]({local})
2. Live: [{live}]({live})
3. Load the **starter example**, then work challenges.
4. Check off the Track B items in [CHECKLIST.md](CHECKLIST.md).

> Browser labs teach literacy — they do not replace writing synthesizable RTL you will commit.

## Media (planned)

| Artifact | Path |
|----------|------|
| Outline | [outline.yaml](outline.yaml) |
| Transcript stub | [transcript.md](transcript.md) |
| Slides / video | generate later with **module-slides** |

## Files

```
module{nn}-{slug}/
├── README.md
├── CHECKLIST.md
├── EXAMPLES.md
├── outline.yaml
├── transcript.md
└── (optional) examples/
```
"""
    (d / "README.md").write_text(body, encoding="utf-8")


def write_checklist(num: int, slug: str, kind: str, title: str, lab_id: str | None) -> None:
    d = mod_dir(num, slug)
    nn = f"{num:02d}"
    if kind == "intro":
        text = f"""# Module {nn} checklist — {title}

## Setup

- [ ] Editor ready for `.v` files
- [ ] Opened this repo at `courses/learn_verilog`
- [ ] Opened the [tools index]({LAB_BASE_LOCAL}/index.html) once (or live site)
- [ ] Optional: confirmed iverilog or HDL Simulator is reachable

## Mindset

- [ ] I understand Track A = real Verilog, Track B = browser lab
- [ ] I know SystemVerilog design constructs are a later course
"""
    elif kind == "wrap":
        text = f"""# Module {nn} checklist — {title}

- [ ] Reviewed outcomes in [README.md](README.md)
- [ ] Ready for **learn_systemverilog** and/or a simulator course
"""
    elif kind == "bridge":
        text = f"""# Module {nn} checklist — {title}

- [ ] Revisited at least one of `fsm-lab` / `alu-explorer` / `mem-map`
- [ ] Wrote (or outlined) a tiny Verilog module matching that concept
- [ ] Can explain how the browser concept maps to ports / always / assign
"""
    else:
        text = f"""# Module {nn} checklist — {title}

## Track A — Real Verilog

- [ ] Worked through at least one prompt in [EXAMPLES.md](EXAMPLES.md)
- [ ] Have a `.v` sketch (even incomplete) for this idea
- [ ] Can explain the outcome in my own words

## Track B — Browser lab (`{lab_id}`)

- [ ] Opened the lab (local or live)
- [ ] Loaded the starter example
- [ ] Completed a few challenges (or noted the lab is still Coming soon)

## Done when

- [ ] I can do the task in real Verilog **or** I finished the browser challenges (preferably both)
"""
    (d / "CHECKLIST.md").write_text(text, encoding="utf-8")


def write_examples_md(num: int, slug: str, kind: str, title: str) -> None:
    d = mod_dir(num, slug)
    nn = f"{num:02d}"
    if kind == "lab":
        text = f"""# Module {nn} examples — {title}

Track A (real Verilog). Keep sketches tiny and synthesizable-minded.

## Prompts

1. Restate the core idea of **{title}** in one sentence.
2. Write a minimal `.v` fragment that demonstrates it (module shell is enough at first).
3. Name one pitfall the browser lab warns about.

## Stretch (optional)

Peek at [`../learn_digital_verilog/`](../learn_digital_verilog/) or [`../learn_verilog_systemverilog/`](../learn_verilog_systemverilog/) for fuller examples — not required to finish the checklist.
"""
    elif kind == "bridge":
        text = f"""# Module {nn} examples — {title}

No new lab id. Reuse `fsm-lab`, `alu-explorer`, and `mem-map` as coding prompts (see [README.md](README.md)).
"""
    else:
        text = f"""# Module {nn} — no example trees

This is an `{kind}` module. See [README.md](README.md).
"""
    (d / "EXAMPLES.md").write_text(text, encoding="utf-8")


def write_outline_transcript(num: int, slug: str, kind: str, title: str, lab_id: str | None) -> None:
    d = mod_dir(num, slug)
    nn = f"{num:02d}"
    (d / "outline.yaml").write_text(
        f"""# Module {nn} outline
title: "{title}"
kind: {kind}
lab: {lab_id or "null"}
slides:
  - Course context / why this matters for RTL
  - Core idea (1 concept)
  - Track B: show lab starter (if lab module)
  - Track A: one tiny .v demo
  - Common pitfalls
  - Your turn + quiz prompt
duration_minutes: 8
""",
        encoding="utf-8",
    )
    if kind == "bridge":
        show_b = "Open fsm-lab (or alu-explorer / mem-map). Point at the concept, then cut to a .v sketch."
        show_a = "Show a minimal Verilog module that could implement the same idea."
    elif lab_id:
        show_b = f"Open the browser lab, `{lab_id}`. Load the starter. Point at the UI."
        show_a = "In an editor, demonstrate one tiny Verilog fragment from EXAMPLES.md."
    else:
        show_b = "Point at the course map / tools index."
        show_a = "Show how the course is meant to be used."
    (d / "transcript.md").write_text(
        f"""# Module {nn} transcript — {title}

> Stub for voiceover / clip. Expand when recording (module-slides).

## Hook

In digital design you will write RTL. This module: **{title}**.

## Teach

(3–5 sentences on the concept.)

## Show Track B

{show_b}

## Show Track A

{show_a}

## Your turn

Complete the checklist for at least one track. Then take the short quiz.
""",
        encoding="utf-8",
    )


def write_docs_index() -> None:
    docs = DST / "docs"
    docs.mkdir(exist_ok=True)
    rows = []
    for num, slug, kind, title, lab_id, status in MODULES:
        lab = f"`{lab_id}`" if lab_id else "—"
        st = status or "—"
        rows.append(
            f"| {num:02d} | `{kind}` | [{title}](../module{num:02d}-{slug}/README.md) | {lab} | {st} |"
        )
    (docs / "MODULES.md").write_text(
        f"""# learn_verilog — module index

Lab-driven syllabus (pass 3). Full product syllabus: [../../syllabus.md](../../syllabus.md#4-learn_verilog).

| # | Kind | Module | Lab | Status |
|---|------|--------|-----|--------|
{chr(10).join(rows)}

## Dual tracks

See [TWO_TRACKS.md](TWO_TRACKS.md).
""",
        encoding="utf-8",
    )
    (docs / "TWO_TRACKS.md").write_text(
        f"""# Two learning tracks

## Track A — Real Verilog

Practice by writing small `.v` sketches (optional iverilog / HDL Simulator).

- Prompts live under each `moduleNN-*/EXAMPLES.md`
- Self-check: `./scripts/module.sh NN --check`

Use this track when you need **fidelity**: ports, always blocks, and lint you will commit.

## Track B — Browser lab

Practice in the learning platform concept labs.

- Local tools: {LAB_BASE_LOCAL}/
- Live: {LAB_BASE_LIVE}/
- Each lab module README links its primary lab id

Use this track for **intuition** and quick challenges.

## Recommended path

1. **Track B** starter + a few challenges (5–10 min)
2. **Track A** tiny `.v` sketch + checklist (10–20 min)
3. Optional quiz / transcript review

Module 18 is a **bridge** (reuse digital labs as coding practice). Doing only one track is OK for self-study; later SV/UVM courses expect Track A comfort.
""",
        encoding="utf-8",
    )


def write_course_readme() -> None:
    landing = [
        f"| {num:02d} — {title} | [module{num:02d}-{slug}](module{num:02d}-{slug}/README.md) |"
        for num, slug, _k, title, *_ in MODULES
    ]
    shipped = sum(1 for m in MODULES if m[5] == "S")
    planned = sum(1 for m in MODULES if m[5] == "P")
    (DST / "README.md").write_text(
        "\n".join(
            [
                "# learn_verilog",
                "",
                "[![GitHub](https://img.shields.io/badge/GitHub-learn__verilog-181717?logo=github)](https://github.com/universal-verification-methodology/learn_verilog)",
                "[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](LICENSE)",
                "[![Role](https://img.shields.io/badge/role-Git%20submodule-orange)](https://github.com/universal-verification-methodology/learning)",
                "[![Parent](https://img.shields.io/badge/parent-learning%20monorepo-0A9EDC)](https://github.com/universal-verification-methodology/learning)",
                "[![Labs](https://img.shields.io/badge/labs-GitHub%20Pages-222?logo=githubpages)](https://universal-verification-methodology.github.io/learning/tools/)",
                "[![Domain](https://img.shields.io/badge/domain-Verilog%20%7C%20IEEE%201364%20%7C%20RTL-purple)](https://github.com/universal-verification-methodology/learn_verilog)",
                "",
                "**learn_verilog** is the open learning path for *RTL coding in the IEEE 1364 family*.",
                "",
                "Readers and students usually **open a module README** (or the live tools) or clone this public repo. Authors edit content here (or via the parent monorepo checkout), rebuild slides/audio with **module-slides** in the parent, and push; the parent repo only stores a pinned submodule commit.",
                "",
                "",
                "## Table of contents",
                "",
                "- [Contents](#contents)",
                "- [Browse or clone](#browse-or-clone)",
                "- [Consume from the parent](#consume-from-the-parent)",
                "- [Author: publish or update](#author-publish-or-update)",
                "- [Two learning tracks](#two-learning-tracks)",
                "- [Module landings](#module-landings)",
                "- [Browser labs](#browser-labs)",
                "- [License](#license)",
                "",
                "## Contents",
                "",
                "```text",
                "learn_verilog/",
                "├── README.md",
                "├── LICENSE",
                "├── docs/",
                "│   ├── MODULES.md       # full module index (00–19)",
                "│   └── TWO_TRACKS.md",
                "├── scripts/",
                "│   └── module.sh",
                "├── module00-intro/",
                "├── module01-module-diagram/",
                "│   ├── README.md · CHECKLIST.md · EXAMPLES.md",
                "│   ├── outline.yaml · transcript.md",
                "│   └── (optional) slides / video / assets/",
                "├── …",
                "└── module19-wrap/",
                "```",
                "",
                "Videos and decks are optional per module. Generate with the **module-slides** skill in the parent monorepo when ready.",
                "",
                "## Browse or clone",
                "",
                "- **Browser labs:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)",
                "- **Syllabus (parent):** [`syllabus.md` § learn_verilog](https://github.com/universal-verification-methodology/learning/blob/main/syllabus.md#4-learn_verilog)",
                "- **Clone this repo alone:**",
                "",
                "```bash",
                "git clone https://github.com/universal-verification-methodology/learn_verilog.git",
                "cd learn_verilog",
                "chmod +x scripts/*.sh",
                "./scripts/module.sh 01 --check",
                "```",
                "",
                "Then open [module00-intro/README.md](module00-intro/README.md).",
                "",
                "## Consume from the parent",
                "",
                "```bash",
                "git clone --recurse-submodules \\",
                "  git@github.com:universal-verification-methodology/learning.git",
                "ls courses/learn_verilog",
                "```",
                "",
                "## Author: publish or update",
                "",
                "```bash",
                "cd courses/learn_verilog",
                "# … edit module README / CHECKLIST / EXAMPLES / transcript …",
                "cd ../..",
                "python .cursor/skills/module-slides/scripts/transcript_to_outline.py \\",
                "  courses/learn_verilog/moduleNN-slug",
                "bash .cursor/skills/module-slides/scripts/narrate_clips.sh \\",
                "  courses/learn_verilog/moduleNN-slug",
                "```",
                "",
                "## Two learning tracks",
                "",
                "Every **lab** module documents both tracks. Intro/wrap/bridge extras differ. Details: [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md).",
                "",
                "| Track | Practice surface | Start here |",
                "|-------|------------------|------------|",
                "| **A — Real Verilog** | `.v` sketches + optional iverilog / HDL Simulator | [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md) |",
                f"| **B — Browser lab** | Platform tools | [local]({LAB_BASE_LOCAL}/) · [live]({LAB_BASE_LIVE}/) |",
                "",
                f"Lab status snapshot: **{shipped} shipped** · **{planned} planned** (see [docs/MODULES.md](docs/MODULES.md)).",
                "",
                "## Module landings",
                "",
                "Full status table: **[docs/MODULES.md](docs/MODULES.md)**. Clusters: 00 intro · 01–05 structure/ops · 06–08 combo hygiene · 09–13 params/generate · 14–15 patterns · 16–17 lint/style · 18 bridge · 19 wrap.",
                "",
                "| Module | Landing |",
                "|--------|---------|",
                *landing,
                "",
                "## Browser labs",
                "",
                "All primary labs for this course are **shipped**: [module-diagram](https://universal-verification-methodology.github.io/learning/tools/module-diagram/) → [verilog-literals](https://universal-verification-methodology.github.io/learning/tools/verilog-literals/) → [wire-vs-reg](https://universal-verification-methodology.github.io/learning/tools/wire-vs-reg/) → [ansi-ports](https://universal-verification-methodology.github.io/learning/tools/ansi-ports/) → [sv-operators](https://universal-verification-methodology.github.io/learning/tools/sv-operators/) → [sensitivity-list](https://universal-verification-methodology.github.io/learning/tools/sensitivity-list/) → [latch-risk](https://universal-verification-methodology.github.io/learning/tools/latch-risk/) → [blocking-vs-nonblocking](https://universal-verification-methodology.github.io/learning/tools/blocking-vs-nonblocking/) → [param-width](https://universal-verification-methodology.github.io/learning/tools/param-width/) → [named-vs-positional](https://universal-verification-methodology.github.io/learning/tools/named-vs-positional/) → [localparam-lab](https://universal-verification-methodology.github.io/learning/tools/localparam-lab/) → [sv-generate](https://universal-verification-methodology.github.io/learning/tools/sv-generate/) → [one-driver](https://universal-verification-methodology.github.io/learning/tools/one-driver/) → [counter-lab](https://universal-verification-methodology.github.io/learning/tools/counter-lab/) → [shift-register-lab](https://universal-verification-methodology.github.io/learning/tools/shift-register-lab/) → [synth-lint](https://universal-verification-methodology.github.io/learning/tools/synth-lint/) → [hdl-style](https://universal-verification-methodology.github.io/learning/tools/hdl-style/). Module 18 reuses digital labs as coding practice.",
                "",
                "## License",
                "",
                "[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see [`LICENSE`](LICENSE).",
                "",
                "Path split from [`learn_digital_verilog`](https://github.com/universal-verification-methodology/learn_digital_verilog) and [`learn_verilog_systemverilog`](https://github.com/universal-verification-methodology/learn_verilog_systemverilog). Platform tools and the parent monorepo may carry additional notices.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def write_scripts() -> None:
    scripts = DST / "scripts"
    scripts.mkdir(exist_ok=True)
    (scripts / "module.sh").write_text(
        r"""#!/usr/bin/env bash
# Generic module helper: ./scripts/module.sh NN [--check|--demo|--help]
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
    if command -v iverilog >/dev/null 2>&1; then
      echo "[OK] iverilog: $(iverilog -V 2>&1 | head -1)"
    else
      echo "[INFO] iverilog not on PATH (optional — use HDL Simulator or editor-only)"
    fi
    [[ -f "$MOD_DIR/EXAMPLES.md" ]] && echo "[OK] EXAMPLES.md"
    [[ -f "$MOD_DIR/CHECKLIST.md" ]] && echo "[OK] CHECKLIST.md"
    echo "[INFO] Track B lab link is in README.md"
    ;;
  --demo)
    echo "Demo: open $MOD_DIR/EXAMPLES.md and README.md"
    ;;
  *)
    echo "Unknown option: $ACTION"
    exit 1
    ;;
esac
""",
        encoding="utf-8",
    )
    (scripts / "README.md").write_text(
        """# Scripts

| Script | Purpose |
|--------|---------|
| `module.sh NN` | `--check` / `--demo` for module number `NN` |
| `_scaffold_course.py` | Regenerate course stubs from syllabus (authors) |

```bash
chmod +x scripts/*.sh
./scripts/module.sh 01 --check
```
""",
        encoding="utf-8",
    )


def write_license() -> None:
    src = COURSES / "learn_unix" / "LICENSE"
    dst = DST / "LICENSE"
    if src.exists():
        dst.write_text(
            src.read_text(encoding="utf-8").replace("learn_unix", "learn_verilog"),
            encoding="utf-8",
        )
    else:
        dst.write_text(
            "Creative Commons Attribution 4.0 International (CC BY 4.0)\n\n"
            "Copyright (c) The learn_verilog contributors.\n\n"
            "https://creativecommons.org/licenses/by/4.0/\n",
            encoding="utf-8",
        )


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    write_license()
    write_course_readme()
    write_docs_index()
    write_scripts()
    for num, slug, kind, title, lab_id, status in MODULES:
        print(f"module{num:02d}-{slug} …")
        write_module_readme(num, slug, kind, title, lab_id, status)
        write_checklist(num, slug, kind, title, lab_id)
        write_examples_md(num, slug, kind, title)
        write_outline_transcript(num, slug, kind, title, lab_id)
    print("Done:", DST)


if __name__ == "__main__":
    main()
