# Platform tools catalog

Canonical list of **browser labs** for the learning monorepo. Tools are organized by **concept domain**, not by course or module. Course repos may link here; this catalog does not mirror any syllabus numbering.

**Live site:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)  
**Local:** `platform/tools/` (see [README.md](README.md))  
**Simulator plan:** [simulator.md](simulator.md) (public `engine.mjs` from [systemverilog-simulator](https://github.com/universal-verification-methodology/systemverilog-simulator); vendored pin under `vendor/systemverilog-simulator/`)

## Principles

| Rule | Meaning |
|------|---------|
| One shelf | All interactive labs live under `platform/tools/` |
| Concept first | Catalog sections name ideas (gates, FSM, Git DAG) — never “Module N” or a course title |
| Browser = hard-to-see | Visualize structures and timing intuition in-tab |
| Offline = fidelity | Real iverilog, Verilator, GTKWave, UVM, synthesis stay in course repos / local toolchains |
| Client-side only | No upload server; work stays in the browser (except links out to GitHub sandboxes) |
| **Starter example** | Every tool opens on a small **worked first example** so the UI is obvious before challenges |

### Starter example (required for new tools)

When shipping or extending a tool, follow this pattern so learners see how it works immediately:

1. **First visit** — load a concrete starter (not an empty canvas). Keep it tiny and correct (e.g. `F = A & B`, one AND gate, `8'h2A` / decimal 42).
2. **Visible caption** — a short “Starter example: …” note at the top (shared class `.starter-note` in `assets/tools-shared.css`).
3. **Reload button** — always offer **Load starter example** (even after `localStorage` restore).
4. **Session restore** — returning visitors may get their last session; the starter button must still reset to the worked example.
5. **Challenges** — **Start** / challenge cards may clear to a blank or constrained state; that is intentional. Do **not** auto-start a challenge on page load.
6. **Document the starter** — when a tool ships, note its starter in the catalog “What it teaches” cell or a one-line comment in the tool JS (`loadStarter()`).

| Tool | Starter (current) |
|------|-------------------|
| `truth-table` | 2 vars, expression `A & B` fills the table via HDL `createCombEvaluator` |
| `gate-composer` | Single AND gate via HDL `createGateNetEvaluator` |
| `radix-converter` | Width 8, value `42` / `0x2A` via HDL `Value` + `parseLiteral` |
| `verilog-literals` | `8'h2A` → bits via HDL `parseLiteral` |
| `clock-stepper` | D-FF starter; Step / ↗posedge / poke via `createSession` |
| `blocking-vs-nonblocking` | Register-swap starter; side-by-side `=` vs `<=` via twin `createSession`s |

### Status legend

| Status | Meaning |
|--------|---------|
| **Shipped** | Implemented under `platform/tools/<id>/` |
| **Planned** | Specified here; not built yet |

### Suggested path id

Folder name under `platform/tools/` when built (kebab-case).

---

## Table of contents

- [Shell & filesystem](#shell--filesystem)
- [Processes & text](#processes--text)
- [Scripting](#scripting)
- [Projects & archives](#projects--archives)
- [Version control](#version-control)
- [Workflow & submission](#workflow--submission)
- [Number systems & representation](#number-systems--representation)
- [Boolean algebra & minimization](#boolean-algebra--minimization)
- [Gates & combinational blocks](#gates--combinational-blocks)
- [HDL structure & operators](#hdl-structure--operators)
- [Combinational design hygiene](#combinational-design-hygiene)
- [Clocks, registers & timing](#clocks-registers--timing)
- [Waveforms & debug literacy](#waveforms--debug-literacy)
- [FSM & control](#fsm--control)
- [Arithmetic & datapath](#arithmetic--datapath)
- [Memory, FIFO & cache](#memory-fifo--cache)
- [Hierarchy, buses & integration](#hierarchy-buses--integration)
- [Coding standards & synthesizability](#coding-standards--synthesizability)
- [Protocols (conceptual)](#protocols-conceptual)
- [Verification planning (lightweight)](#verification-planning-lightweight)
- [Out of scope (offline only)](#out-of-scope-offline-only)
- [Build phases](#build-phases)
- [Cross-reference (courses → domains)](#cross-reference-courses--domains)

---

## Shell & filesystem

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Virtual filesystem terminal | `vfs-terminal` | **Shipped** | `pwd`, `ls`/`-a`, globs, `less`, `man`, `ln -s`, `head`/`tail`/`wc`; 22 challenges |
| Permissions, umask, PATH & ownership | `permissions` | **Shipped** | Modes, umask, `which`/PATH, owner/group, `export`; 22 challenges |

## Processes & text

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pipes, redirection, xargs & jobs | `pipes` | **Shipped** | `\|`, redirects, `tee`, `xargs`, jobs; 22 graded challenges |

## Scripting

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Script exit codes & control flow | `scripting` | **Shipped** | Args, `if`/`for`/`case`, alias, functions, `read`, `set -e`; 23 challenges |

## Projects & archives

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Project layout, archives, sed & diff | `project-archives` | **Shipped** | Tree, find/grep, tar, sed, diff/patch; 22 challenges |

## Version control

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Git graph, staging, stash & rebase | `git-graph` | **Shipped** | Status, add/commit, merge/rebase, cherry-pick, stash, tags, ignore; 22 challenges |
| Merge conflict resolver | `git-conflicts` | **Shipped** | Conflict markers; ours / theirs / manual; 22 scenarios |
| Blame & bisect | `blame-bisect` | **Shipped** | Line attribution; binary search for first bad commit; 22 challenges |
| Remotes, PRs & submodules | `remotes` | **Shipped** | 22-question concept quiz + live GitHub checklist (clone, Make, push, PR, submodule) |

## Workflow & submission

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pre-push checklist, Make & env | `workflow` | **Shipped** | `check_ready`, `make test`, `.env`, dry-run clean; 22 challenges |

---

## Number systems & representation

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Radix / bit-width converter | `radix-converter` | **Shipped** | HDL `Value` / `parseLiteral`; starter `0x2A`; overflow; 22 challenges |
| Verilog literal decoder | `verilog-literals` | **Shipped** | HDL `parseLiteral`; starter `8'h2A`; 28 challenges; X/Z/? |

## Boolean algebra & minimization

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Truth-table builder | `truth-table` | **Shipped** | Fills via public HDL `createCombEvaluator`; starter `A & B`; SOP/POS; 22 challenges |
| K-map minimizer (2–4 vars) | `kmap` | **Planned** | Visual grouping → minimal expression |
| Boolean law playground | `boolean-laws` | **Planned** | Step-through De Morgan and algebra rewrites |

## Gates & combinational blocks

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Gate composer | `gate-composer` | **Shipped** | HDL `createGateNetEvaluator`; schematic; 29 challenges |
| Mux / decoder / encoder explorer | `mux-decoder` | **Planned** | Select lines → data / one-hot outputs |
| Priority encoder & comparator | `priority-compare` | **Planned** | Priority resolution; signed vs unsigned compare |

## HDL structure & operators

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Module / port diagram | `module-diagram` | **Planned** | Template or paste → hierarchy and named ports |
| Operator playground | `sv-operators` | **Planned** | Bitwise vs logical, concat/replicate, reduction |
| Parameter / width explorer | `param-width` | **Planned** | `#(.WIDTH(N))` effect on buses |

## Combinational design hygiene

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Combo style / latch-risk checker | `latch-risk` | **Planned** | Same function as `assign` vs `always`/`case`; flag missing defaults |
| Sensitivity-list explorer | `sensitivity-list` | **Planned** | Which signals trigger recomputation (teaching model) |

## Clocks, registers & timing

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Clock-edge stepper | `clock-stepper` | **Shipped** | 8 labs (D-FF · T-FF · enable · counters · shift · pipeline · load); signal trace; 22 challenges |
| Blocking vs non-blocking | `blocking-vs-nonblocking` | **Shipped** | Side-by-side `=` vs `<=` (swap · pipeline · chain · RHS · 3-stage); 20 challenges |
| Reset strategy timelines | `reset-timelines` | **Planned** | Sync vs async reset on a simple timeline |
| Setup / hold explainer | `setup-hold` | **Planned** | Annotated timing diagram (conceptual; not SPICE) |

## Waveforms & debug literacy

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Mini waveform viewer | `waveform-mini` | **Planned** | Small synthetic or JSON/VCD subset; signal naming & hierarchy |
| Testbench anatomy explorer | `tb-anatomy` | **Planned** | DUT vs tb, `$display`/`$finish`, reg vs wire roles |

## FSM & control

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| FSM designer + stepper | `fsm-lab` | **Planned** | Draw states/transitions; Moore/Mealy; step input stream; state table |
| State encoding lab | `state-encoding` | **Planned** | Binary vs one-hot vs Gray; FF count and transition glitches |
| Sequence detector playground | `seq-detector` | **Planned** | e.g. detect `1011` with stepped inputs |

## Arithmetic & datapath

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Ripple-carry adder animator | `rca-animator` | **Planned** | Carry ripples bit-by-bit |
| CLA generate/propagate visualizer | `cla-gp` | **Planned** | G/P tree for small widths |
| Array multiplier grid | `array-mult` | **Planned** | Partial-product visualization |
| ALU operation explorer | `alu-explorer` | **Planned** | Opcode → result and flags (Z/C/V) |

## Memory, FIFO & cache

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| RAM / ROM address map | `mem-map` | **Planned** | Read/write highlights; `$readmemh` concept |
| FIFO pointer & flags | `fifo-lab` | **Planned** | Full/empty; sync FIFO behavioral model |
| Cache hit/miss walkthrough | `cache-walk` | **Planned** | Tag/index/offset; small direct-mapped set |

## Hierarchy, buses & integration

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Block-diagram integrator | `block-diagram` | **Planned** | Connect CPU / datapath / memory-style blocks |
| Bus handshake animator | `handshake` | **Planned** | Valid/ready timing (conceptual) |

## Coding standards & synthesizability

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Synthesizability linter (static) | `synth-lint` | **Planned** | Flag `#delay`, bad initials, latch patterns (rule-based) |
| Naming / style checker | `hdl-style` | **Planned** | Prefixes (`clk_`, `rst_n_`), section order heuristics |

## Protocols (conceptual)

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| UART frame animator | `uart-frame` | **Planned** | Start/data/parity/stop bit timeline |
| SPI transaction stepper | `spi-step` | **Planned** | SCLK/MOSI/MISO/CS for a short transfer |
| I²C start/addr/ack explorer | `i2c-lab` | **Planned** | Start, address+R/W, ACK/NACK sequence |

## Verification planning (lightweight)

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Coverage / plan checklist | `verif-plan-check` | **Planned** | Feature → scenario → coverage item mapping (document aid) |
| Testbench layer diagram | `tb-layers` | **Planned** | Agent / env / scoreboard roles as a block sketch (not a UVM runtime) |

---

## Out of scope (offline only)

Do **not** implement these as full browser replacements:

- iverilog compile + `vvp` simulation of course examples  
- Verilator `--cc` + C++ build  
- Full GTKWave / large FST/VCD workflows  
- Full SystemVerilog OOP / UVM / constrained-random / coverage databases  
- Synthesis (Yosys, Vivado, DC) and P&R  
- Cycle-accurate protocol VIPs and scoreboards  
- Toolchain installers and CI Make flows  

Those stay in course repos and local / WSL environments. Browser tools may **link** to sandboxes or docs.

---

## Build phases

Suggested delivery order (platform rebrand, then digital concepts):

| Phase | Focus | Tools |
|-------|--------|--------|
| **A** | Unify hub branding & catalog UX | Rebrand home/tools index to concept domains; keep shipped Shell/Git tools |
| **B** | Digital logic core | `truth-table` (**shipped**), `gate-composer` (**shipped**), `radix-converter` (**shipped**), `verilog-literals` (**shipped**), `clock-stepper` (**shipped**), `blocking-vs-nonblocking` (**shipped**), `fsm-lab`, `waveform-mini` |
| **C** | Datapath & memory | `rca-animator`, `alu-explorer`, `fifo-lab`, `mem-map`, `cache-walk` |
| **D** | HDL hygiene & protocols | `latch-risk`, `synth-lint`, `handshake`, `uart-frame` / `spi-step` / `i2c-lab` (as needed) |
| **E** | Verification literacy | `tb-anatomy`, `tb-layers`, `verif-plan-check` |

Phases are planning aids only; the public catalog stays domain-based.

---

## Cross-reference (courses → domains)

Courses **link** to domains; they do not own tools.

| Course (under `courses/`) | Primary domains they typically use |
|---------------------------|--------------------------------------|
| `learn_unix_git` | Shell & filesystem, Processes & text, Scripting, Projects & archives, Version control, Workflow |
| `learn_digital_verilog` | Number systems, Boolean, Gates, HDL structure, Combo hygiene, Clocks, Waveforms, FSM, Arithmetic, Memory, Hierarchy, Synth lint |
| `learn_verilog_systemverilog` | Number systems, HDL structure & operators, Combo hygiene (language-evolution context) |
| `learn_verilator_iverilog` | Waveforms & debug literacy, Testbench anatomy |
| `learn_uart_spi_i2c` | FSM & control, Handshake, Protocols (conceptual); real VIP/UVM offline |
| `learn_uvm_pyuvm` | TB layers (sketch only); methodology offline |
| `learn_uvm2017_sv_verilator` | TB layers (sketch only); UVM offline |
| `verification_planning_management` | Verification planning checklists |

---

## Counts

| Status | Count |
|--------|------:|
| Shipped | 15 |
| Planned | 31 |
| **Total catalogued** | **46** |

Update this file when a planned tool ships (status → **Shipped**, path verified under `platform/tools/`).
