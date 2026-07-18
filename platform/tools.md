# Platform tools catalog

Canonical list of **browser labs** for the learning monorepo. Tools are organized by **concept domain**, not by course or module. Course repos may link here; this catalog does not mirror any syllabus numbering.

**Live site:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)  
**Local:** `platform/tools/` (see [README.md](README.md))

## Principles

| Rule | Meaning |
|------|---------|
| One shelf | All interactive labs live under `platform/tools/` |
| Concept first | Catalog sections name ideas (gates, FSM, Git DAG) — never “Module N” or a course title |
| Browser = hard-to-see | Visualize structures and timing intuition in-tab |
| Offline = fidelity | Real iverilog, Verilator, GTKWave, UVM, synthesis stay in course repos / local toolchains |
| Client-side only | No upload server; work stays in the browser (except links out to GitHub sandboxes) |

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
| Virtual filesystem terminal | `vfs-terminal` | **Shipped** | `pwd`, `ls`/`-a`, globs, `less`, `man`, `ln -s`, `head`/`tail`/`wc` |
| Permissions, umask, PATH & ownership | `permissions` | **Shipped** | Modes, umask, `which`/PATH, owner/group, `export` |

## Processes & text

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pipes, redirection, xargs & jobs | `pipes` | **Shipped** | `\|`, redirects, `tee`, `xargs`, background jobs / `kill` |

## Scripting

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Script exit codes & control flow | `scripting` | **Shipped** | Args, `if`/`for`/`case`, alias, functions, `read`, `set -e` |

## Projects & archives

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Project layout, archives, sed & diff | `project-archives` | **Shipped** | Tree, find/grep, tar, sed, diff/patch |

## Version control

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Git graph, staging, stash & rebase | `git-graph` | **Shipped** | Status, add/commit, merge/rebase, cherry-pick, stash, tags, ignore, reflog |
| Merge conflict resolver | `git-conflicts` | **Shipped** | Conflict markers; ours / theirs / manual |
| Blame & bisect | `blame-bisect` | **Shipped** | Line attribution; binary search for first bad commit |
| Remotes, PRs & submodules | `remotes` | **Shipped** | Checklist against live GitHub sandbox (clone, Make, push, PR, submodule) |

## Workflow & submission

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pre-push checklist, Make & env | `workflow` | **Shipped** | `check_ready`, `make test`, `.env`, dry-run clean |

---

## Number systems & representation

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Radix / bit-width converter | `radix-converter` | **Planned** | Binary / hex / decimal / two’s complement; overflow for a chosen width |
| Verilog literal decoder | `verilog-literals` | **Planned** | Parse `4'b1010`, `8'hFF`, signed widths → bit vectors |

## Boolean algebra & minimization

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Truth-table builder | `truth-table` | **Shipped** | 2–10 vars; live SOP/POS; 10 challenges; save/print/CSV |
| K-map minimizer (2–4 vars) | `kmap` | **Planned** | Visual grouping → minimal expression |
| Boolean law playground | `boolean-laws` | **Planned** | Step-through De Morgan and algebra rewrites |

## Gates & combinational blocks

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Gate composer | `gate-composer` | **Shipped** | Netlist + schematic; 19 challenges; live table / JSON |
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
| Clock-edge stepper | `clock-stepper` | **Planned** | Advance one edge; D-FF / register / counter state |
| Blocking vs non-blocking animator | `blocking-nba` | **Planned** | Side-by-side `=` vs `<=` in the same cycle |
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
| **B** | Digital logic core | `truth-table` (**shipped**), `gate-composer` (**shipped**), `radix-converter`, `verilog-literals`, `fsm-lab`, `clock-stepper`, `blocking-nba`, `waveform-mini` |
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
| Shipped | 12 |
| Planned | 34 |
| **Total catalogued** | **46** |

Update this file when a planned tool ships (status → **Shipped**, path verified under `platform/tools/`).
