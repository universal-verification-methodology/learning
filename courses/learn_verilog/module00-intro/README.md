# Module 00: Welcome to Verilog RTL

**Kind:** `intro` · Dual-track course welcome

← Start · [Course README](../README.md) · [Module / port diagram →](../module01-module-diagram/README.md)

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
3. Or use the live site: https://universal-verification-methodology.github.io/learning/tools/

## How to move through modules

1. Read the module **README** (outcomes).
2. Pick a track (or both).
3. Check off **CHECKLIST.md**.
4. Optional: skim `outline.yaml` / `transcript.md` for upcoming slides & clips.

## Media

| Artifact | Path |
|----------|------|
| Transcript | [transcript.md](transcript.md) |
| Outline | [outline.yaml](outline.yaml) |
| Slides | [slides.pptx](slides.pptx) · [slides.pdf](slides.pdf) |
| Audio | [audio/full.mp3](audio/full.mp3) |
| Video | [video.mp4](video.mp4) |
| Quiz | [quiz.json](quiz.json) |
| Tools snapshot | [assets/lab-tools-index.png](assets/lab-tools-index.png) |


## Next

→ [Module 01: Module / port diagram](../module01-module-diagram/README.md)
