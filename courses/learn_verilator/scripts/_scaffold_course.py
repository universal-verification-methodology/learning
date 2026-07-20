#!/usr/bin/env python3
"""Scaffold courses/learn_verilator from syllabus (lab-driven + dual tracks)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # courses/learn_verilator
COURSES = ROOT.parent
DST = ROOT

LAB_BASE_LOCAL = "http://127.0.0.1:8080/tools"
LAB_BASE_LIVE = "https://universal-verification-methodology.github.io/learning/tools"
LEGACY = "../learn_verilator_iverilog"

# Status from disk audit (2026-07). All Verilator-specific browser labs Planned.
MODULES = [
    (0, "intro", "intro", "Welcome to Verilator", None, None),
    (1, "iverilog-vs-verilator", "lab", "iverilog vs Verilator", "iverilog-vs-verilator", "P"),
    (2, "sim-pipeline", "lab", "Compile → elaborate → run", "sim-pipeline", "P"),
    (3, "verilator-lint-lab", "lab", "Verilator lint", "verilator-lint-lab", "P"),
    (4, "dpi-cpp-tb", "lab", "C++ TB / DPI sketch", "dpi-cpp-tb", "P"),
    (5, "tb-clock-reset", "lab", "TB clock + reset patterns", "tb-clock-reset", "P"),
    (6, "verilator-trace", "lab", "Verilator trace", "verilator-trace", "P"),
    (7, "wave-dump", "lab", "Wave dump literacy", "wave-dump", "P"),
    (8, "verilator-public", "lab", "Verilator public", "verilator-public", "P"),
    (9, "verif-metrics", "lab", "Verification metrics", "verif-metrics", "P"),
    (10, "offline-verilator-example", "offline", "Build & run a Verilator example", "course-makefile", None),
    (11, "wrap", "wrap", "Verilator track complete", None, None),
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

**learn_verilator** treats Verilator as a **tool**: lint → C++/DPI TB → trace → metrics — not a full UVM course.

| Track | Where you practice | Best for |
|-------|--------------------|----------|
| **A — Real Verilator** | Local Verilator + C++ / Makefile examples | Fidelity, install, real VCD/FST |
| **B — Browser lab** | Conceptual literacy labs on the platform | Chooser / pipeline / lint diagrams |

Sibling: **learn_iverilog**. Combined legacy: [`{LEGACY}/`]({LEGACY}/).  
Do **not** re-teach UVM here — see **learn_uvm2017**.

## Setup (Track A)

1. Install Verilator (and a C++ toolchain) — see install scripts under [`{LEGACY}/`]({LEGACY}/).
2. Confirm `verilator --version` works.
3. Open this repo at `courses/learn_verilator`.

## Setup (Track B)

1. Serve the platform: `python -m http.server 8080 --directory platform` (from monorepo root).
2. Open http://127.0.0.1:8080/tools/index.html — Simulation literacy section (most Verilator labs still Coming soon).
3. Optional literacy refreshers if shipped: [`waveform-lab`]({LAB_BASE_LOCAL}/waveform-lab/index.html), [`tb-anatomy`]({LAB_BASE_LOCAL}/tb-anatomy/index.html).

## How to move through modules

1. Read the module **README** (outcomes).
2. Prefer Track A — browser labs for this course are mostly still planned.
3. Check off **CHECKLIST.md**.
4. Optional: skim `outline.yaml` / `transcript.md` for upcoming slides & clips.

## Media (planned)

| Artifact | Path |
|----------|------|
| Outline | [outline.yaml](outline.yaml) |
| Transcript stub | [transcript.md](transcript.md) |
| Slides / video | generate later with **module-slides** |

## Next

→ [Module 01: iverilog vs Verilator](../module01-iverilog-vs-verilator/README.md)
"""
    elif kind == "wrap":
        body = f"""# Module {nn}: {title}

**Kind:** `wrap`

{nav_line}

## You can now

- Choose Verilator vs iverilog for a given job
- Explain lint, C++/DPI TB, `--trace`, and `/*verilator public*/` roles
- Build and run at least one offline Verilator example from the legacy course
- Point at metrics ideas (pass rate / coverage concepts) without claiming a full UVM flow

## Dual-track recap

If you mainly used **Track A**, sketch the sim pipeline on paper when browser labs ship.  
If you mainly waited on **Track B**, finish module 10 offline before claiming the track complete.

## Next courses

→ **learn_iverilog** · **learn_hdl_simulator** · **learn_uvm2017**  
Syllabus ladder: [../../syllabus.md](../../syllabus.md#suggested-learning-ladder)

## Checklist

- [ ] I completed Track A for the modules I care about (browser optional)
- [ ] I ran at least one real Verilator build
- [ ] I know UVM depth lives in **learn_uvm2017**, not here
"""
    elif kind == "offline":
        body = f"""# Module {nn}: {title}

**Kind:** `offline` · Activity: course Makefile / Verilator run

{nav_line}

## Outcomes

After this module you can **build and run** a Verilator example offline (not in the browser).

## Practice surface (Track A only)

1. Open the legacy course: [`{LEGACY}/`]({LEGACY}/).
2. Follow that repo’s README / module scripts for a small Verilator + C++ (or Verilog TB) example.
3. Capture the command line you used and the pass/fail result in your notes.

```bash
# Typical shape (exact targets vary by legacy module):
cd courses/learn_verilator_iverilog
# … see scripts/ and module READMEs …
```

## Track B

None required — use any Simulation literacy sketch that has shipped if you need a concept refresher.

## Media (planned)

| Artifact | Path |
|----------|------|
| Outline | [outline.yaml](outline.yaml) |
| Transcript stub | [transcript.md](transcript.md) |
| Slides / video | screen-capture of real toolchain (module-slides) |
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

After this module you can explain and practice the ideas taught by **`{lab_id}`**, in the browser and/or with a real Verilator run.

## Two tracks (pick one or both)

### Track A — Real Verilator (hands-on)

1. Open [EXAMPLES.md](EXAMPLES.md) and work the prompts.
2. Complete [CHECKLIST.md](CHECKLIST.md); use [`{LEGACY}/`]({LEGACY}/) when helpful.
3. Optional self-check: `./scripts/module.sh {nn} --check` (from course root).

### Track B — Browser lab (online)

1. Local: [{local}]({local})
2. Live: [{live}]({live})
3. Load the **starter example**, then work challenges (or note Coming soon).
4. Check off the Track B items in [CHECKLIST.md](CHECKLIST.md).

> Concept labs are literacy tools — they do not replace installing and running Verilator.

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

- [ ] Verilator install attempted (or noted why deferred)
- [ ] Opened this repo at `courses/learn_verilator`
- [ ] Peeked at [`{LEGACY}/`]({LEGACY}/)
- [ ] Opened the [tools index]({LAB_BASE_LOCAL}/index.html) Simulation literacy section once

## Mindset

- [ ] I understand Verilator is a **tool** course, not UVM
- [ ] I know Track A (real Verilator) is the fidelity path
"""
    elif kind == "wrap":
        text = f"""# Module {nn} checklist — {title}

- [ ] Reviewed outcomes in [README.md](README.md)
- [ ] Ready for iverilog / HDL simulator / UVM as needed
"""
    elif kind == "offline":
        text = f"""# Module {nn} checklist — {title}

- [ ] Built/ran at least one example under [`{LEGACY}/`]({LEGACY}/)
- [ ] Noted the command line and result
- [ ] Know this is not a browser lab
"""
    else:
        text = f"""# Module {nn} checklist — {title}

## Track A — Real Verilator

- [ ] Worked through at least one prompt in [EXAMPLES.md](EXAMPLES.md)
- [ ] Can explain the outcome in my own words

## Track B — Browser lab (`{lab_id}`)

- [ ] Opened the lab (local or live) **or** noted Coming soon
- [ ] If shipped: loaded starter + completed a few challenges

## Done when

- [ ] I can do the task offline **or** I finished the browser challenges (preferably both when shipped)
"""
    (d / "CHECKLIST.md").write_text(text, encoding="utf-8")


def write_examples_md(num: int, slug: str, kind: str, title: str) -> None:
    d = mod_dir(num, slug)
    nn = f"{num:02d}"
    if kind == "lab":
        text = f"""# Module {nn} examples — {title}

Track A (Verilator tool literacy). Browser lab may still be planned.

## Prompts

1. Restate the core idea of **{title}** in one sentence.
2. Sketch one command line or diagram (lint flags, `--trace`, public, …).
3. Optional: peek at [`{LEGACY}/`]({LEGACY}/) for a matching Verilator example.

## Stretch

When the browser lab ships, redo the same idea with the starter challenges.
"""
    elif kind == "offline":
        text = f"""# Module {nn} examples — {title}

Offline only. Follow [`{LEGACY}/`]({LEGACY}/) module READMEs / Makefiles.

## Prompt

1. Pick one small DUT + Verilator flow from the legacy course.
2. Record: commands, pass/fail, and one thing you would change next time.
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
  - Course context / when Verilator wins
  - Core idea (1 concept)
  - Track B: show lab starter if shipped (else diagram)
  - Track A: real command-line cue
  - Common pitfalls
  - Your turn + quiz prompt
duration_minutes: 8
""",
        encoding="utf-8",
    )
    if kind == "offline":
        show_b = "None — offline toolchain capture."
        show_a = "Screen-capture a real Verilator build from the legacy course."
    elif lab_id:
        show_b = f"Open the browser lab, `{lab_id}` (or note Coming soon and show a diagram)."
        show_a = "Show a Verilator command line or tiny C++ TB cue from EXAMPLES.md."
    else:
        show_b = "Point at the Simulation literacy section on the tools index."
        show_a = "Show when to pick Verilator vs iverilog."
    (d / "transcript.md").write_text(
        f"""# Module {nn} transcript — {title}

> Stub for voiceover / clip. Expand when recording (module-slides).

## Hook

Verilator is how many open flows get cycle-accurate speed. This module: **{title}**.

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
        f"""# learn_verilator — module index

Lab-driven syllabus (pass 3). Full product syllabus: [../../syllabus.md](../../syllabus.md#7-learn_verilator).

| # | Kind | Module | Lab | Status |
|---|------|--------|-----|--------|
{chr(10).join(rows)}

## Dual tracks

See [TWO_TRACKS.md](TWO_TRACKS.md). Legacy: [`{LEGACY}/`]({LEGACY}/).
""",
        encoding="utf-8",
    )
    (docs / "TWO_TRACKS.md").write_text(
        f"""# Two learning tracks

## Track A — Real Verilator

Practice with a local Verilator install + C++ / Makefile examples.

- Prompts under each `moduleNN-*/EXAMPLES.md`
- Full examples in [`{LEGACY}/`]({LEGACY}/)
- Self-check: `./scripts/module.sh NN --check`
- Module 10 is **offline-only** (course Makefile)

## Track B — Browser lab

- Local tools: {LAB_BASE_LOCAL}/
- Live: {LAB_BASE_LIVE}/
- Verilator-specific literacy labs remain **Planned** until they ship
- Optional shared literacy: `waveform-lab`, `tb-anatomy` (shipped elsewhere)

## Recommended path

1. Intro + install Verilator
2. Track A through lint / C++ TB / trace using legacy examples
3. Module 10 offline run
4. Return to browser labs as they ship
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
                "# learn_verilator",
                "",
                "[![GitHub](https://img.shields.io/badge/GitHub-learn__verilator-181717?logo=github)](https://github.com/universal-verification-methodology/learn_verilator)",
                "[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](LICENSE)",
                "[![Role](https://img.shields.io/badge/role-Git%20submodule-orange)](https://github.com/universal-verification-methodology/learning)",
                "[![Parent](https://img.shields.io/badge/parent-learning%20monorepo-0A9EDC)](https://github.com/universal-verification-methodology/learning)",
                "[![Labs](https://img.shields.io/badge/labs-GitHub%20Pages-222?logo=githubpages)](https://universal-verification-methodology.github.io/learning/tools/)",
                "[![Domain](https://img.shields.io/badge/domain-Verilator%20%7C%20simulation-purple)](https://github.com/universal-verification-methodology/learn_verilator)",
                "",
                "**learn_verilator** is the open learning path for *Verilator as a tool*: lint → C++/DPI TB → trace → metrics.",
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
                "learn_verilator/",
                "├── README.md",
                "├── LICENSE",
                "├── docs/",
                "│   ├── MODULES.md       # full module index (00–11)",
                "│   └── TWO_TRACKS.md",
                "├── scripts/",
                "│   └── module.sh",
                "├── module00-intro/",
                "├── module10-offline-verilator-example/",
                "├── …",
                "└── module11-wrap/",
                "```",
                "",
                "Videos and decks are optional per module. Generate with the **module-slides** skill in the parent monorepo when ready.",
                "",
                "## Browse or clone",
                "",
                "- **Browser labs:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)",
                "- **Legacy:** [`learn_verilator_iverilog`](https://github.com/universal-verification-methodology/learn_verilator_iverilog)",
                "- **Syllabus (parent):** [`syllabus.md` § learn_verilator](https://github.com/universal-verification-methodology/learning/blob/main/syllabus.md#7-learn_verilator)",
                "",
                "```bash",
                "git clone https://github.com/universal-verification-methodology/learn_verilator.git",
                "cd learn_verilator",
                "chmod +x scripts/*.sh",
                "./scripts/module.sh 10 --check",
                "```",
                "",
                "Then open [module00-intro/README.md](module00-intro/README.md).",
                "",
                "## Consume from the parent",
                "",
                "```bash",
                "git clone --recurse-submodules \\",
                "  git@github.com:universal-verification-methodology/learning.git",
                "ls courses/learn_verilator",
                "```",
                "",
                "## Author: publish or update",
                "",
                "```bash",
                "cd courses/learn_verilator",
                "# … edit module README / CHECKLIST / EXAMPLES / transcript …",
                "cd ../..",
                "python .cursor/skills/module-slides/scripts/transcript_to_outline.py \\",
                "  courses/learn_verilator/moduleNN-slug",
                "bash .cursor/skills/module-slides/scripts/narrate_clips.sh \\",
                "  courses/learn_verilator/moduleNN-slug",
                "```",
                "",
                "## Two learning tracks",
                "",
                "Details: [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md).",
                "",
                "| Track | Practice surface | Start here |",
                "|-------|------------------|------------|",
                f"| **A — Real Verilator** | Local Verilator · [`{LEGACY}`]({LEGACY}/) | [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md) |",
                f"| **B — Browser lab** | Simulation literacy (mostly planned) | [tools index]({LAB_BASE_LIVE}/) |",
                "",
                f"Lab status snapshot: **{shipped} shipped** · **{planned} planned** browser labs; module 10 is offline (see [docs/MODULES.md](docs/MODULES.md)).",
                "",
                "## Module landings",
                "",
                "Full status table: **[docs/MODULES.md](docs/MODULES.md)**. Clusters: 00 intro · 01–02 chooser/pipeline · 03–05 lint/C++/reset · 06–09 trace/metrics · 10 offline · 11 wrap.",
                "",
                "| Module | Landing |",
                "|--------|---------|",
                *landing,
                "",
                "## Browser labs",
                "",
                f"**Planned:** `iverilog-vs-verilator`, `sim-pipeline`, `verilator-lint-lab`, `dpi-cpp-tb`, `tb-clock-reset`, `verilator-trace`, `wave-dump`, `verilator-public`, `verif-metrics`. Fidelity is Track A + [{LEGACY}]({LEGACY}/). Optional shared literacy: [waveform-lab](https://universal-verification-methodology.github.io/learning/tools/waveform-lab/) · [tb-anatomy](https://universal-verification-methodology.github.io/learning/tools/tb-anatomy/).",
                "",
                "## License",
                "",
                "[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see [`LICENSE`](LICENSE).",
                "",
                "Path split from [`learn_verilator_iverilog`](https://github.com/universal-verification-methodology/learn_verilator_iverilog). Platform tools and the parent monorepo may carry additional notices.",
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
    if command -v verilator >/dev/null 2>&1; then
      echo "[OK] verilator: $(verilator --version 2>&1 | head -1)"
    else
      echo "[INFO] verilator not on PATH (install for Track A)"
    fi
    if command -v g++ >/dev/null 2>&1 || command -v clang++ >/dev/null 2>&1; then
      echo "[OK] C++ compiler present"
    else
      echo "[INFO] g++/clang++ not found (needed for Verilator C++ TB)"
    fi
    LEGACY="$(cd "$ROOT/.." && pwd)/learn_verilator_iverilog"
    if [[ -d "$LEGACY" ]]; then
      echo "[OK] legacy course present: $LEGACY"
    else
      echo "[INFO] legacy learn_verilator_iverilog not checked out"
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
./scripts/module.sh 10 --check
```
""",
        encoding="utf-8",
    )


def write_license() -> None:
    src = COURSES / "learn_unix" / "LICENSE"
    dst = DST / "LICENSE"
    if src.exists():
        dst.write_text(
            src.read_text(encoding="utf-8").replace("learn_unix", "learn_verilator"),
            encoding="utf-8",
        )
    else:
        dst.write_text(
            "Creative Commons Attribution 4.0 International (CC BY 4.0)\n\n"
            "Copyright (c) The learn_verilator contributors.\n\n"
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
