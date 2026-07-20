> **Site copy** of repo-root [../syllabus.md](../syllabus.md). Re-copy after editing the canonical file.

# Target course syllabus

Canonical **target** syllabi for the learning monorepo (pass 3 · **lab-driven** · 2026-07).

| | |
|--|--|
| **Web / local site** | [`platform/syllabus.md`](platform/syllabus.md) → http://127.0.0.1:8080/syllabus.md |
| **Tools catalog** | [`platform/tools.md`](platform/tools.md) · [tools index](http://127.0.0.1:8080/tools/index.html) |
| **HDL Simulator** | https://universal-verification-methodology.github.io/systemverilog-simulator/ |

---

## Design rules (pass 3)

**Lab-driven modules** — not a fixed “7 modules per course.”

| Rule | Meaning |
|------|---------|
| **1 module ≈ 1 lab** | Each content module has **one primary browser lab** (or one offline activity if no lab fits). |
| **Flexible length** | Course module count = intro/wrap extras + number of labs in the path. |
| **Media unit** | Each module is sized for a short **deck + transcript + video clip** (roughly 5–15 min teach + lab time). |
| **Extras allowed** | `intro` (course welcome / how to use), `bridge` (connect ideas, no new lab), `wrap` (checklist / next course), `offline` (sandbox / toolchain only). |
| **Concept shelf** | Labs live under `platform/tools/` and stay reusable across courses. |

**Module kinds**

| Kind | Role | Typical media |
|------|------|----------------|
| `intro` | Welcome, prereqs, how this course works | Short talk + course map slide |
| `lab` | One concept + one primary lab | Clip → open lab → quiz |
| `bridge` | Glue text between clusters (optional) | Short bridge slide / voiceover |
| `offline` | Real shell / GitHub / iverilog / Verilator / UVM | Demo clip + local steps |
| `wrap` | What you can do now; next course | Recap + links |

**Lab markers:** **(S)** shipped · **(P)** planned / Coming soon

**Surfaces:** browser lab · course examples/scripts · sandbox/offline toolchain

---

## Pass 3 vs pass 2

- Dropped hard **7 modules / 7 days** pacing.
- Modules renumbered as **lab-first** lists; course length varies.
- Added **`intro` / `wrap` / `bridge` / `offline`** kinds for PPT, transcript, and clip production.
- Overview table shows **module counts** (not “7 days”).
- Prefer **one primary lab id** per `lab` module (stretch labs stay in the tools catalog, not as required modules).

---

## Table of contents

1. [Course overview](#course-overview)
2. [Media production notes](#media-production-notes)
3. [learn_unix](#1-learn_unix)
4. [learn_git](#2-learn_git)
5. [learn_digital](#3-learn_digital)
6. [learn_verilog](#4-learn_verilog)
7. [learn_systemverilog](#5-learn_systemverilog)
8. [learn_uvm2017](#6-learn_uvm2017)
9. [learn_verilator](#7-learn_verilator)
10. [learn_iverilog](#8-learn_iverilog)
11. [learn_hdl_simulator](#9-learn_hdl_simulator)
12. [learn_pyuvm](#10-learn_pyuvm)
13. [learn_uart](#11-learn_uart)
14. [learn_spi](#12-learn_spi)
15. [learn_i2c](#13-learn_i2c)
16. [learn_verification_planning_management](#14-learn_verification_planning_management)
17. [Suggested learning ladder](#suggested-learning-ladder)
18. [Migration from existing courses](#migration-from-existing-courses)

---

## Course overview

| # | Course id | Focus | Prereq | Modules (approx.) |
|---|-----------|-------|--------|-------------------|
| 1 | `learn_unix` | Shell → scripts → project hygiene | — | ~20 (intro + labs + wrap) |
| 2 | `learn_git` | Model → commit → branch → remotes → deliver | Unix recommended | ~18 |
| 3 | `learn_digital` | Logic & datapath concepts | — | ~22 |
| 4 | `learn_verilog` | IEEE 1364 RTL coding | Digital recommended | ~16 |
| 5 | `learn_systemverilog` | IEEE 1800 design (not UVM) | Verilog | ~12 |
| 6 | `learn_uvm2017` | UVM methodology (SV) | SystemVerilog + TB | ~16 |
| 7 | `learn_verilator` | Verilator as a tool | Verilog; C++ helpful | ~10 |
| 8 | `learn_iverilog` | Icarus as a tool | Verilog | ~10 |
| 9 | `learn_hdl_simulator` | Browser HDL Simulator *(rename later)* | Verilog helpful | ~10 |
| 10 | `learn_pyuvm` | cocotb → pyuvm | Python + Verilog + sim | ~12 |
| 11 | `learn_uart` | UART spec → RTL → TB → VIP map | Verilog | ~10 |
| 12 | `learn_spi` | SPI same arc | Verilog | ~10 |
| 13 | `learn_i2c` | I²C same arc | Verilog | ~10 |
| 14 | `learn_verification_planning_management` | Plan → coverage → CI → sign-off | Protocol or UVM helpful | ~12 |

Counts are **planning targets** (intro/wrap + one row per lab). Add/drop `bridge` modules when recording media without changing the lab shelf.

---

## Media production notes

For each **`lab`** module, ship a small media bundle (same pattern as Dataset Fundamentals “parts”):

1. **Outline** — 5–8 bullets (also feeds slides)
2. **Deck** — short PPT/PDF (one idea)
3. **Transcript** — speakable script for the clip
4. **Video clip** — teach → show lab UI → “your turn”
5. **Quiz** — 3–5 items after the lab (optional shared quiz bank)

**`intro` / `wrap`:** lighter — course map, prereqs, “open tools index,” next-course link.  
**`offline`:** screen capture of real toolchain; link sandbox READMEs.

Suggested folder shape (when you implement):

```text
courses/<course_id>/
  moduleNN-<slug>/          # or media/moduleNN/
    outline.yaml
    slides.pptx | slides.pdf
    transcript.md
    video.mp4               # optional until recorded
    README.md               # outcomes + lab link
```

---

## 1. `learn_unix`

**Goal:** Shell fluency for digital design students.  
**Course tree:** [`courses/learn_unix/`](courses/learn_unix/) (dual track: real Unix + browser labs).  
**Source legacy:** `learn_unix_git` M1–5 (+ workflow from M8).  
**Offline:** local shell; `./scripts/scaffold.sh` / `./scripts/module.sh NN`.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to Unix for design | Course map; terminal setup |
| 01 | lab | Virtual filesystem terminal | `vfs-terminal` **(S)** |
| 02 | lab | man / --help discoverability | `man-help-lab` **(S)** |
| 03 | lab | Absolute vs relative paths | `path-abs-rel` **(S)** |
| 04 | lab | Globs & wildcards | `wildcards-globs` **(S)** |
| 05 | lab | File types & links | `file-types-lab` **(S)** |
| 06 | lab | realpath / readlink | `realpath-resolve` **(S)** |
| 07 | lab | Permissions, umask, PATH | `permissions` **(S)** |
| 08 | lab | Dotfiles & config homes | `dotfiles-lab` **(S)** |
| 09 | lab | Process list & signals | `ps-kill-lab` **(S)** |
| 10 | lab | Job control | `job-control-lab` **(S)** |
| 11 | lab | Pipes, redirection, xargs | `pipes` **(S)** |
| 12 | lab | sort / uniq / cut | `sort-uniq-cut` **(S)** |
| 13 | lab | Here-doc / here-string | `here-doc-lab` **(S)** |
| 14 | lab | Shell history & reverse-search | `shell-history` **(S)** |
| 15 | lab | Alias & functions | `alias-lab` **(S)** |
| 16 | lab | Script control flow | `scripting` **(S)** |
| 17 | lab | Exit status & `&&` / `\|\|` | `exit-status-lab` **(S)** |
| 18 | lab | Safe scripting | `safe-scripting` **(S)** |
| 19 | lab | Project layout, archives, sed & diff | `project-archives` **(S)** |
| 20 | lab | tar vs zip | `zip-vs-tar` **(S)** |
| 21 | lab | Backup & clean-build | `backup-clean` **(S)** |
| 22 | lab | Relative symlink pitfalls | `link-relative` **(S)** |
| 23 | lab | Pre-push / Make / env checklist | `workflow` **(S)** |
| 24 | lab | Makefile basics | `make-basics` **(P)** |
| 25 | lab | Dry-run mindset | `dry-run-lab` **(P)** |
| 26 | lab | Log / failure triage | `log-triage` **(P)** |
| 27 | lab | `.env` literacy | `env-file-lab` **(P)** |
| 28 | wrap | Unix path complete → Git | Recap; link `learn_git` |

*Optional bridges:* after 08 (env cluster), after 18 (scripting cluster), after 22 (archives cluster).

---

## 2. `learn_git`

**Goal:** Git for coursework through delivery.  
**Course tree:** [`courses/learn_git/`](courses/learn_git/) (dual track: real Git + browser labs).  
**Source legacy:** `learn_unix_git` M6–7 (+ submit from M8).  
**Offline:** [`unix-git-practice`](https://github.com/universal-verification-methodology/unix-git-practice) ([`SANDBOX.md`](courses/learn_git/SANDBOX.md)).

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to Git for coursework | Why Git; sandbox overview |
| 01 | lab | Git mental model | `git-mental-model` **(S)** |
| 02 | lab | Graph, stage, commit (playground) | `git-graph` **(S)** |
| 03 | lab | `.gitignore` patterns | `gitignore-lab` **(S)** |
| 04 | lab | Commit messages | `commit-message-lab` **(S)** |
| 05 | lab | `git log` options | `git-log-lab` **(S)** |
| 06 | lab | Safe undo | `git-undo-safe` **(S)** |
| 07 | lab | Stash scenarios | `git-stash-lab` **(S)** |
| 08 | lab | Tags | `git-tags-lab` **(S)** |
| 09 | lab | Branch naming | `branch-strategy` **(S)** |
| 10 | lab | Merge conflicts | `git-conflicts` **(S)** |
| 11 | lab | Rebase vs merge | `git-rebase-merge` **(S)** |
| 12 | lab | Cherry-pick | `git-cherry-pick-lab` **(S)** |
| 13 | lab | Reflog recovery | `git-reflog` **(S)** |
| 14 | lab | Blame & bisect | `blame-bisect` **(S)** |
| 15 | lab | Remotes, PRs & submodules (concepts) | `remotes` **(S)** |
| 16 | lab | Remote-tracking branches | `remote-tracking` **(S)** |
| 17 | lab | PR review checklist | `pr-review-lab` **(S)** |
| 18 | lab | Submodule pitfalls | `submodule-pitfalls` **(S)** |
| 19 | lab | Template-repo bootstrap | `template-clone` **(S)** |
| 20 | lab | Submission reproducibility | `submission-repro` **(S)** |
| 21 | offline | Live sandbox: clone → Make → PR | `unix-git-practice` |
| 22 | wrap | Git path complete | Recap; next: Digital or Verilog |

---

## 3. `learn_digital`

**Goal:** Digital logic foundations without deep HDL syntax.  
**Course tree:** [`courses/learn_digital/`](courses/learn_digital/) (dual track: workbook + browser labs).  
**Source legacy:** `learn_digital_verilog` theory (M1, M3–7).

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to digital foundations | Number → gates → FSM → memory map |
| 01 | lab | Radix & bit width | `radix-converter` **(S)** |
| 02 | lab | Two’s complement | `twos-complement` **(S)** |
| 03 | lab | Overflow / wrap | `overflow-wrap` **(S)** |
| 04 | lab | ASCII / hex dump | `ascii-hex` **(S)** |
| 05 | lab | Gray code | `gray-code` **(S)** |
| 06 | lab | BCD | `bcd-lab` **(S)** |
| 07 | lab | Parity / checksum | `parity-checksum` **(S)** |
| 08 | lab | Fixed-point Qm.n | `fixed-point` **(S)** |
| 09 | lab | Bit-fields | `bit-fields` **(S)** |
| 10 | lab | Endian packing | `endian-lab` **(S)** |
| 11 | lab | Truth tables | `truth-table` **(S)** |
| 12 | lab | Boolean laws | `boolean-laws` **(S)** |
| 13 | lab | K-maps | `kmap` **(S)** |
| 14 | lab | SOP ↔ POS | `sop-pos` **(S)** |
| 15 | lab | Don’t-care minimization | `dont-care-lab` **(S)** |
| 16 | lab | Logic hazards | `logic-hazards` **(S)** |
| 17 | lab | Gate composer | `gate-composer` **(S)** |
| 18 | lab | Mux / decoder / encoder | `mux-decoder` **(S)** |
| 19 | lab | Priority & compare | `priority-compare` **(S)** |
| 20 | lab | Half / full adder | `half-full-adder` **(S)** |
| 21 | lab | XOR parity tree | `xor-parity-tree` **(S)** |
| 22 | lab | Tri-state / bus | `tri-state-bus` **(S)** |
| 23 | lab | Barrel shifter | `barrel-shifter` **(S)** |
| 24 | lab | Seven-segment | `seven-segment` **(S)** |
| 25 | lab | Clock-edge stepper | `clock-stepper` **(S)** |
| 26 | lab | Setup / hold | `setup-hold` **(S)** |
| 27 | lab | Reset timelines | `reset-timelines` **(S)** |
| 28 | lab | Clock enable vs gated clock | `clock-enable` **(S)** |
| 29 | lab | CDC / 2-FF sync | `cdc-sync` **(S)** |
| 30 | lab | FSM designer | `fsm-lab` **(S)** |
| 31 | lab | State encoding | `state-encoding` **(S)** |
| 32 | lab | Sequence detector | `seq-detector` **(S)** |
| 33 | lab | Ring / Johnson | `ring-johnson` **(S)** |
| 34 | lab | LFSR / PRBS | `lfsr-lab` **(S)** |
| 35 | lab | Ripple-carry adder | `ripple-carry-adder-animator` **(S)** |
| 36 | lab | Carry-lookahead G/P | `carry-look-ahead-adder-propagate-and-generate` **(S)** |
| 37 | lab | Array multiplier | `array-mult` **(S)** |
| 38 | lab | ALU explorer | `alu-explorer` **(S)** |
| 39 | lab | Carry-select sketch | `carry-select-adder` **(S)** |
| 40 | lab | Booth encode | `booth-encode` **(S)** |
| 41 | lab | Signed arithmetic | `signed-arith` **(S)** |
| 42 | lab | RAM / ROM map | `mem-map` **(S)** |
| 43 | lab | FIFO pointers | `fifo-lab` **(S)** |
| 44 | lab | Cache walk | `cache-walk` **(S)** |
| 45 | lab | Dual-port RAM | `dual-port-ram` |
| 46 | lab | Byte-enable memory | `byte-enable-mem` |
| 47 | lab | Async FIFO (Gray) | `async-fifo` |
| 48 | lab | Handshake (valid/ready) | `handshake` **(S)** |
| 49 | lab | Block-diagram integrator | `block-diagram` **(S)** |
| 50 | wrap | Digital complete → Verilog | Recap; link `learn_verilog` |

*Optional bridges:* after number systems (10), Boolean (16), sequential (29), FSM (34), datapath (41).

---

## 4. `learn_verilog`

**Goal:** RTL coding in the IEEE 1364 family.  
**Course tree:** [`courses/learn_verilog/`](courses/learn_verilog/) (dual track: real Verilog + browser labs).  
**Source legacy:** digital M2 + RTL of M3–7; `learn_verilog_systemverilog` M1–3.  
**Run checks:** `learn_hdl_simulator` and/or `learn_iverilog`.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to Verilog RTL | Module → always → style map |
| 01 | lab | Module / port diagram | `module-diagram` **(S)** |
| 02 | lab | Verilog literals | `verilog-literals` **(S)** |
| 03 | lab | wire vs reg | `wire-vs-reg` **(S)** |
| 04 | lab | ANSI vs non-ANSI ports | `ansi-ports` **(S)** |
| 05 | lab | Operators | `sv-operators` **(S)** |
| 06 | lab | Sensitivity lists | `sensitivity-list` **(S)** |
| 07 | lab | Latch risk | `latch-risk` **(S)** |
| 08 | lab | Blocking vs non-blocking | `blocking-vs-nonblocking` **(S)** |
| 09 | lab | Parameter / width | `param-width` **(S)** |
| 10 | lab | Named vs positional | `named-vs-positional` **(S)** |
| 11 | lab | localparam | `localparam-lab` **(S)** |
| 12 | lab | Generate / replication | `sv-generate` **(S)** |
| 13 | lab | One-driver nets | `one-driver` **(S)** |
| 14 | lab | Counter patterns | `counter-lab` **(S)** |
| 15 | lab | Shift-register patterns | `shift-register-lab` **(S)** |
| 16 | lab | Synthesizability lint | `synth-lint` **(S)** |
| 17 | lab | HDL style | `hdl-style` **(S)** |
| 18 | bridge | FSM & datapath in RTL | Reuse `fsm-lab` / `alu-explorer` / `mem-map` as coding practice (clips only) |
| 19 | wrap | Verilog complete → SV or simulators | Recap; links |

---

## 5. `learn_systemverilog`

**Goal:** SystemVerilog **design** constructs (IEEE 1800) — not UVM.  
**Course tree:** [`courses/learn_systemverilog/`](courses/learn_systemverilog/) (dual track: real SV + browser labs).  
**Source legacy:** `learn_verilog_systemverilog` M4–8.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to SV design | 1364 → 1800 story |
| 01 | lab | bit vs logic | `bit-vs-logic` **(S)** |
| 02 | lab | always_comb / ff / latch | `sv-always-procs` **(S)** |
| 03 | lab | Typedef / enum / struct | `sv-typedefs` **(S)** |
| 04 | lab | Multi-dimensional arrays | `multi-dim-arrays` **(S)** |
| 05 | lab | Signed / unsigned width | `signed-width` **(S)** |
| 06 | lab | Interfaces & modports | `sv-interfaces` **(S)** |
| 07 | lab | Packages & import | `sv-packages` **(S)** |
| 08 | lab | unique / priority case | `sv-case-unique` **(S)** |
| 09 | lab | inside / wildcards | `sv-inside` **(S)** |
| 10 | lab | Checker / bind | `sv-checker` **(S)** |
| 11 | lab | IEEE construct → version map | `ieee-version-map` **(S)** |
| 12 | lab | 1364 → 1800 migration | `sv-migration` **(S)** |
| 13 | wrap | SV design complete → UVM or protocols | Recap |

---

## 6. `learn_uvm2017`

**Goal:** UVM methodology literacy + offline practice.  
**Course tree:** [`courses/learn_uvm2017/`](courses/learn_uvm2017/) (dual track: real UVM + browser sketches).  
**Source legacy:** `learn_uvm2017_sv_verilator`.  
**Offline:** UVM library + Verilator (or commercial).

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to UVM | Why layered TB; course map |
| 01 | lab | TB layers | `tb-layers` **(P)** |
| 02 | lab | Basic TB vs UVM map | `tb-vs-uvm-map` |
| 03 | lab | TB anatomy refresh | `tb-anatomy` **(S)** |
| 04 | lab | UVM phases | `uvm-phases` **(P)** |
| 05 | lab | Factory | `uvm-factory` **(P)** |
| 06 | lab | ConfigDB | `uvm-configdb` **(P)** |
| 07 | lab | Agent anatomy | `uvm-agent` **(P)** |
| 08 | lab | TLM ports | `uvm-tlm` **(P)** |
| 09 | lab | Sequence → driver | `uvm-seq-flow` **(P)** |
| 10 | lab | Objections | `uvm-objections` **(P)** |
| 11 | lab | Plusargs / testname | `uvm-plusargs` **(P)** |
| 12 | lab | CRV lite | `crv-lite` |
| 13 | lab | Scoreboard | `uvm-scoreboard` **(P)** |
| 14 | lab | RAL map | `ral-map` **(P)** |
| 15 | lab | SVA timeline (lite) | `sva-timeline` |
| 16 | lab | Multi-agent env | `uvm-multi-agent` **(P)** |
| 17 | lab | Virtual sequence | `uvm-vseq` **(P)** |
| 18 | lab | Callbacks | `uvm-callbacks` **(P)** |
| 19 | lab | Reporting | `uvm-reporting` **(P)** |
| 20 | lab | Protocol checker | `protocol-checker` **(P)** |
| 21 | lab | VIP anatomy | `vip-anatomy` **(P)** |
| 22 | offline | Run a course UVM example | Course Makefile / Verilator |
| 23 | wrap | UVM complete → planning or VIP work | Recap |

---

## 7. `learn_verilator`

**Goal:** Verilator as a **tool**.  
**Course tree:** [`courses/learn_verilator/`](courses/learn_verilator/) (dual track: real Verilator + browser literacy).  
**Source legacy:** `learn_verilator_iverilog` Verilator lane.  
**Offline:** real Verilator installs (module 10).

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to Verilator | When to use it |
| 01 | lab | iverilog vs Verilator | `iverilog-vs-verilator` **(P)** |
| 02 | lab | Compile → elaborate → run | `sim-pipeline` **(P)** |
| 03 | lab | Verilator lint | `verilator-lint-lab` **(P)** |
| 04 | lab | C++ TB / DPI sketch | `dpi-cpp-tb` **(P)** |
| 05 | lab | TB clock + reset patterns | `tb-clock-reset` |
| 06 | lab | Verilator trace | `verilator-trace` **(P)** |
| 07 | lab | Wave dump literacy | `wave-dump` **(P)** |
| 08 | lab | Verilator public | `verilator-public` **(P)** |
| 09 | lab | Verification metrics | `verif-metrics` **(P)** |
| 10 | offline | Build & run a Verilator example | Course Makefile |
| 11 | wrap | Verilator track complete | Recap |

---

## 8. `learn_iverilog`

**Goal:** Icarus Verilog as a **tool**.  
**Course tree:** [`courses/learn_iverilog/`](courses/learn_iverilog/) (dual track: real iverilog + browser labs).  
**Source legacy:** `learn_verilator_iverilog` iverilog lane.  
**Offline:** real iverilog + GTKWave (module 11).

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to Icarus | `iverilog` → `vvp` story |
| 01 | lab | Compile → elaborate → run | `sim-pipeline` **(P)** |
| 02 | lab | iverilog flags | `iverilog-flags` **(P)** |
| 03 | lab | Timescale | `iverilog-timescale` **(P)** |
| 04 | lab | Delay / event / wait | `delay-event-wait` **(S)** |
| 05 | lab | Task vs function | `task-vs-function` **(S)** |
| 06 | lab | Fork / join | `fork-join` **(S)** |
| 07 | lab | vvp plusargs | `vvp-plusargs` **(P)** |
| 08 | lab | Self-checking TB | `self-check-tb` |
| 09 | lab | Wave dump + waveform lab | `wave-dump` **(P)** / `waveform-lab` **(S)** |
| 10 | lab | GTKWave cursors | `gtkwave-cursors` **(S)** |
| 11 | offline | Compile & dump a course example | Local iverilog |
| 12 | wrap | Icarus track complete | Recap |

---

## 9. `learn_hdl_simulator`

**Working title** — rename later.  
**Goal:** Guided path for the [HDL Simulator](https://universal-verification-methodology.github.io/systemverilog-simulator/).  
**Practice surface:** full simulator IDE; `hdl-sim-*` labs teach workflow.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to the browser simulator | Link live IDE; what you’ll practice |
| 01 | lab | UI tour | `hdl-sim-tour` **(P)** |
| 02 | lab | Hello DUT | `hdl-sim-hello-dut` **(P)** |
| 03 | lab | Step & continue | `hdl-sim-step-continue` **(P)** |
| 04 | lab | Poke / force / release | `hdl-sim-poke-force` **(P)** |
| 05 | lab | Full-sim waves | `hdl-sim-waves` **(P)** |
| 06 | lab | Multi-file project | `hdl-sim-multi-file` **(P)** |
| 07 | lab | Golden compare | `hdl-sim-compare-golden` **(P)** |
| 08 | bridge | Style & synth hints in the IDE | `hdl-style` **(S)**, `synth-lint` **(S)** (short clip) |
| 09 | offline | Open public simulator — free practice | [HDL Simulator](https://universal-verification-methodology.github.io/systemverilog-simulator/) |
| 10 | wrap | Simulator path complete | Recap; back to Verilog/TB |

---

## 10. `learn_pyuvm`

**Goal:** Python verification — cocotb → pyuvm.  
**Course tree:** [`courses/learn_pyuvm/`](courses/learn_pyuvm/) (dual track: real cocotb/pyuvm + browser sketches).  
**Source legacy:** `learn_uvm_pyuvm`.  
**Offline:** cocotb + pyuvm + Verilator (or other) — module 10.  
**Browser tools:** pyuvm-specific labs all **(P)**; optional shipped literacy `tb-anatomy` / `tb-vs-uvm-map`.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to pyuvm | Python vs SV UVM map |
| 01 | lab | Python async TB | `python-async-tb` **(P)** |
| 02 | lab | cocotb triggers | `cocotb-triggers` **(P)** |
| 03 | lab | cocotb DUT handle | `cocotb-dut-handle` **(P)** |
| 04 | lab | cocotb ↔ UVM roles | `cocotb-uvm-map` **(P)** |
| 05 | lab | UVM phases (shared sketch) | `uvm-phases` **(P)** |
| 06 | lab | Factory (shared sketch) | `uvm-factory` **(P)** |
| 07 | lab | Agent / seq flow | `uvm-agent` **(P)** / `uvm-seq-flow` **(P)** |
| 08 | lab | ConfigDB & objections | `uvm-configdb` **(P)** / `uvm-objections` **(P)** |
| 09 | lab | Scoreboard & multi-agent | `uvm-scoreboard` **(P)** / `uvm-multi-agent` **(P)** |
| 10 | offline | Run a pyuvm example | Course repo |
| 11 | wrap | pyuvm complete | Recap; compare to `learn_uvm2017` |

*Note:* Where two labs share a module row, split into two `lab` modules when recording clips (preferred). Combined rows are temporary until media is cut.

---

## Protocol courses (11–13)

Shared arc: **spec → RTL sketch → TB → waves → VIP map**.  
Do **not** re-teach full verification planning inside each protocol — point to course 14 for planning depth.

---

## 11. `learn_uart`

**Goal:** UART spec → RTL → TB → waves → VIP map.  
**Course tree:** [`courses/learn_uart/`](courses/learn_uart/) (dual track: real RTL/TB + browser labs).  
**Source legacy:** `learn_uart_spi_i2c` UART lane.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to UART | Spec → RTL → TB map |
| 01 | lab | UART frame | `uart-frame` |
| 02 | lab | Spec → RTL checklist | `spec-to-rtl` |
| 03 | lab | Baud / divider | `baud-divider` |
| 04 | lab | Oversampling | `uart-oversample` |
| 05 | lab | UART errors | `uart-errors` |
| 06 | lab | FIFO in the datapath | `fifo-lab` **(S)** |
| 07 | lab | Handshake | `handshake` **(S)** |
| 08 | lab | Self-check TB | `self-check-tb` |
| 09 | lab | TB clock / reset | `tb-clock-reset` |
| 10 | lab | Waves | `waveform-lab` **(S)** |
| 11 | lab | TB vs UVM map | `tb-vs-uvm-map` |
| 12 | lab | VIP anatomy | `vip-anatomy` **(P)** |
| 13 | wrap | UART complete | Recap; SPI / I²C / UVM |

---

## 12. `learn_spi`

**Goal:** SPI wires & modes → RTL → TB → waves → VIP map.  
**Course tree:** [`courses/learn_spi/`](courses/learn_spi/) (dual track: real RTL/TB + browser labs).  
**Source legacy:** `learn_uart_spi_i2c` SPI lane.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to SPI | Wires & modes map |
| 01 | lab | SPI transaction step | `spi-step` |
| 02 | lab | Spec → RTL | `spec-to-rtl` |
| 03 | lab | CPOL/CPHA | `spi-cpol-cpha` |
| 04 | lab | Multi-CS / daisy | `spi-multi-cs` |
| 05 | lab | Shift-register datapath | `shift-register-lab` **(S)** |
| 06 | lab | FSM for CS | `fsm-lab` **(S)** |
| 07 | lab | Self-check TB | `self-check-tb` |
| 08 | lab | Waves | `waveform-lab` **(S)** |
| 09 | lab | TB vs UVM / VIP | `tb-vs-uvm-map` / `protocol-checker` **(P)** |
| 10 | wrap | SPI complete | Recap |

---

## 13. `learn_i2c`

**Goal:** I²C open-drain → RTL → TB → waves → VIP map.  
**Course tree:** [`courses/learn_i2c/`](courses/learn_i2c/) (dual track: real RTL/TB + browser labs).  
**Source legacy:** `learn_uart_spi_i2c` I²C lane.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to I²C | Open-drain story |
| 01 | lab | I²C start/addr/ack | `i2c-lab` |
| 02 | lab | Spec → RTL | `spec-to-rtl` |
| 03 | lab | Open-drain model | `i2c-open-drain` |
| 04 | lab | Clock stretch | `i2c-clock-stretch` |
| 05 | lab | Repeated start | `i2c-repeated-start` |
| 06 | lab | FSM bit/byte | `fsm-lab` **(S)** |
| 07 | lab | Self-check TB | `self-check-tb` |
| 08 | lab | Waves | `waveform-lab` **(S)** |
| 09 | lab | TB vs UVM / VIP | `tb-vs-uvm-map` / `vip-anatomy` **(P)** |
| 10 | wrap | I²C complete | Recap |

---

## 14. `learn_verification_planning_management`

**Goal:** Plan → coverage → regression → sign-off.  
**Source today:** `verification_planning_management`.

| # | Kind | Module | Primary lab / activity |
|---|------|--------|-------------------------|
| 00 | intro | Welcome to verification planning | Stakeholders & scope |
| 01 | lab | Coverage / plan checklist | `verif-plan-check` **(P)** |
| 02 | lab | Test taxonomy | `test-taxonomy` **(P)** |
| 03 | lab | Feature × scenario matrix | `feature-matrix` **(P)** |
| 04 | lab | Cover bins sketch | `cover-bins` |
| 05 | lab | Coverage closure | `coverage-closure` **(P)** |
| 06 | lab | Risk-based plan | `risk-plan` **(P)** |
| 07 | lab | Seed / config / tags | `seed-tags` **(P)** |
| 08 | lab | Regression triage | `regression-triage` **(P)** |
| 09 | lab | Verification metrics | `verif-metrics` **(P)** |
| 10 | lab | CI / farm flow | `ci-farm-flow` **(P)** |
| 11 | lab | Sign-off checklist | `signoff-checklist` **(P)** |
| 12 | lab | VIP handoff | `vip-handoff` **(P)** |
| 13 | wrap | Planning path complete | Recap |

---

## Suggested learning ladder

```text
learn_unix ──► learn_git
      │
      ▼
learn_digital ──► learn_verilog ──► learn_systemverilog
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
 learn_hdl_simulator  learn_iverilog  learn_verilator
          │
          ▼
   learn_uart / learn_spi / learn_i2c
          │
          ├──────────────► learn_uvm2017
          └──────────────► learn_pyuvm
          │
          ▼
 learn_verification_planning_management
```

Take modules in order inside a course; skip `bridge` when self-studying; never skip required **(S)** labs if you want the certificate-style path later.

---

## Migration from existing courses

| Existing folder | Maps to |
|-----------------|---------|
| `learn_unix_git` | `learn_unix` (**scaffolded** under `courses/learn_unix/`) + `learn_git` (**scaffolded** under `courses/learn_git/`; M6–7 labs, M8 → offline/wrap) |
| `learn_digital_verilog` | `learn_digital` (**scaffolded** under `courses/learn_digital/`) + parts of `learn_verilog` (**scaffolded** under `courses/learn_verilog/`) |
| `learn_verilog_systemverilog` | `learn_verilog` (**scaffolded**) + `learn_systemverilog` (**scaffolded** under `courses/learn_systemverilog/`) |
| `learn_verilator_iverilog` | `learn_verilator` + `learn_iverilog` (**both scaffolded** under `courses/`) |
| `learn_uvm2017_sv_verilator` | `learn_uvm2017` (**scaffolded** under `courses/learn_uvm2017/`) |
| `learn_uvm_pyuvm` | `learn_pyuvm` (**scaffolded** under `courses/learn_pyuvm/`) |
| `learn_uart_spi_i2c` | `learn_uart` + `learn_spi` + `learn_i2c` (**all scaffolded** under `courses/`) |
| `verification_planning_management` | `learn_verification_planning_management` |

**Repo layout later:** prefer `moduleNN-<lab-id>/` aligned to this table so media (`outline`, `slides`, `transcript`, `video`) stays 1:1 with labs.

---

## Related docs

- Tools catalog: [`platform/tools.md`](platform/tools.md)
- Tools index: [`platform/tools/index.html`](platform/tools/index.html)
- Platform README: [`platform/README.md`](platform/README.md)
- Site syllabus copy: [`platform/syllabus.md`](platform/syllabus.md)
- HDL simulator: https://universal-verification-methodology.github.io/systemverilog-simulator/
