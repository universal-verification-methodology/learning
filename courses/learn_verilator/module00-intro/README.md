# Module 00: Welcome to Verilator

**Kind:** `intro` · Dual-track course welcome

← Start · [Course README](../README.md) · [iverilog vs Verilator →](../module01-iverilog-vs-verilator/README.md)

## What this course is

**learn_verilator** treats Verilator as a **tool**: lint → C++/DPI TB → trace → metrics — not a full UVM course.

| Track | Where you practice | Best for |
|-------|--------------------|----------|
| **A — Real Verilator** | Local Verilator + C++ / Makefile examples | Fidelity, install, real VCD/FST |
| **B — Browser lab** | Conceptual literacy labs on the platform | Chooser / pipeline / lint diagrams |

Sibling: **learn_iverilog**. Combined legacy: [`../learn_verilator_iverilog/`](../learn_verilator_iverilog/).  
Do **not** re-teach UVM here — see **learn_uvm2017**.

## Setup (Track A)

1. Install Verilator (and a C++ toolchain) — see install scripts under [`../learn_verilator_iverilog/`](../learn_verilator_iverilog/).
2. Confirm `verilator --version` works.
3. Open this repo at `courses/learn_verilator`.

## Setup (Track B)

1. Serve the platform: `python -m http.server 8080 --directory platform` (from monorepo root).
2. Open http://127.0.0.1:8080/tools/index.html — Simulation literacy section (most Verilator labs still Coming soon).
3. Optional literacy refreshers if shipped: [`waveform-lab`](http://127.0.0.1:8080/tools/waveform-lab/index.html), [`tb-anatomy`](http://127.0.0.1:8080/tools/tb-anatomy/index.html).

## How to move through modules

1. Read the module **README** (outcomes).
2. Prefer Track A — browser labs for this course are mostly still planned.
3. Check off **CHECKLIST.md**.
4. Optional: skim `outline.yaml` / `transcript.md` for upcoming slides & clips.

## Media

| Artifact | Path |
|----------|------|
| Transcript | [transcript.md](transcript.md) |
| Outline | [outline.yaml](outline.yaml) |
| Slides | [slides.pptx](slides.pptx) · [slides.pdf](slides.pdf) |
| Video | [video.mp4](video.mp4) |
| Quiz | [quiz.json](quiz.json) |

## Next

→ [Module 01: iverilog vs Verilator](../module01-iverilog-vs-verilator/README.md)
