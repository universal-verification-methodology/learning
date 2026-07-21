# Platform tools catalog

Canonical list of **browser labs** for the learning monorepo. Tools are organized by **concept domain**, not by course or module. Course repos may link here; this catalog does not mirror any syllabus numbering.

**Live site:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)  
**Local:** `platform/tools/` (see [README.md](README.md))  
**Simulator plan:** [simulator.md](simulator.md) (public `engine.mjs` from [systemverilog-simulator](https://github.com/universal-verification-methodology/systemverilog-simulator); vendored pin under `vendor/systemverilog-simulator/`)

## Principles

| Rule | Meaning |
|------|---------|
| One shelf | All interactive labs live under `platform/tools/` |
| Concept first | Catalog sections name ideas (gates, FSM, Git DAG) â€” never â€œModule Nâ€ or a course title |
| Browser = hard-to-see | Visualize structures and timing intuition in-tab |
| Offline = fidelity | Real iverilog, Verilator, GTKWave, UVM, synthesis stay in course repos / local toolchains |
| Client-side only | No upload server; work stays in the browser (except links out to GitHub sandboxes) |
| **Starter example** | Every tool opens on a small **worked first example** so the UI is obvious before challenges |

### Starter example (required for new tools)

When shipping or extending a tool, follow this pattern so learners see how it works immediately:

1. **First visit** â€” load a concrete starter (not an empty canvas). Keep it tiny and correct (e.g. `F = A & B`, one AND gate, `8'h2A` / decimal 42).
2. **Visible caption** â€” a short â€œStarter example: â€¦â€ note at the top (shared class `.starter-note` in `assets/tools-shared.css`).
3. **Reload button** â€” always offer **Load starter example** (even after `localStorage` restore).
4. **Session restore** â€” returning visitors may get their last session; the starter button must still reset to the worked example.
5. **Challenges** â€” **Start** / challenge cards may clear to a blank or constrained state; that is intentional. Do **not** auto-start a challenge on page load.
6. **Document the starter** â€” when a tool ships, note its starter in the catalog â€œWhat it teachesâ€ cell or a one-line comment in the tool JS (`loadStarter()`).

| Tool | Starter (current) |
|------|-------------------|
| `truth-table` | 2 vars, expression `A & B` fills the table via HDL `createCombEvaluator` |
| `gate-composer` | Single AND gate via HDL `createGateNetEvaluator` |
| `radix-converter` | Width 8, value `42` / `0x2A` via HDL `Value` + `parseLiteral` |
| `verilog-literals` | `8'h2A` â†’ bits via HDL `parseLiteral` |
| `clock-stepper` | D-FF starter; Step / â†—posedge / poke via `createSession` |
| `blocking-vs-nonblocking` | Register-swap starter; side-by-side `=` vs `<=` via twin `createSession`s |
| `kmap` | 2-var XOR (`A'B + AB'`) with two highlighted groups |
| `mux-decoder` | 2:1 mux, S=0, D0=1, D1=0 â†’ Y=1 |
| `priority-compare` | 4-input high-first encoder, I0=I2=1 â†’ winner I2 |
| `boolean-laws` | `~(AÂ·B)` â†’ apply De Morgan â†’ `A'+B'` |
| `sv-operators` | `4'b1010 & 4'b1100` â†’ `1000` (vs `&&` â†’ `1`) |
| `alu-explorer` | 4-bit ADD, A=5, B=3 â†’ Y=8 with Z/N/C/V |
| `latch-risk` | 2:1 mux as `assign` (OK) vs incomplete `if` (latch) |
| `param-width` | `#(.WIDTH(8))` â†’ `logic [7:0]` data ports |
| `mem-map` | 16Ã—8 RAM with `DE AD BE EF` via `$readmemh`-style dump |
| `array-mult` | 4-bit unsigned `5 Ã— 3` partial-product grid â†’ 15 |
| `sensitivity-list` | `Y = A & B` with `always @(A or B)` â€” both inputs wake the block |
| `state-encoding` | 4 states, binary (2 FFs); compare one-hot / Gray Hamming on the ring |
| `ripple-carry-adder-animator` | 4-bit `5 + 3` â€” step carry through full adders â†’ 8 |
| `carry-look-ahead-adder-propagate-and-generate` | 4-bit `5 + 3` â€” G/P table + expanded Câ‚â€¦Câ‚„ |
| `synth-lint` | Clean `assign y = a & b`; engine `lintSynthesizability` |
| `hdl-style` | Clean FF with `clk`/`rst_n`; engine `lintStyle` |
| `cache-walk` | Cold cache, addr `0x14` â†’ miss + install; second access â†’ hit |
| `fifo-lab` | Depth-4 empty FIFO â€” push `0xA5` â†’ count=1, empty clears |
| `async-fifo` | Empty async FIFO; Gray=0; step wclk once â†’ write `0xA5`, empty sticky until sync |
| `pipeline-hazards` | ALU→ALU RAW with forward — ADD then SUB; run → R3=8, R4=7, bubbles=0 |
| `uart-frame` | 0xA5 as 8N1 — idle/start/data/stop timeline |
| `uart-oversample` | 16× clean 0-bit — mid tick 8 sample |
| `uart-errors` | Clean 0xA5 8E1 — framing/parity/overrun clear |
| `spi-step` | Mode 0 — master 0xA5 ↔ slave 0x5A |
| `spi-multi-cs` | Multi-CS CS0 ↔ 0x5A; compare daisy chain |
| `i2c-lab` | START → 0x50 W → ACK → STOP |
| `spec-to-rtl` | UART TX — ports + BAUD_DIV + block checklist |
| `tb-vs-uvm-map` | UART TX — pin wiggle ↔ driver mapped |
| `sv-class-sketch` | UartPacket extends Packet (object tree) |
| `crv-lite` | data inside {[0:15]} — seed 42, one legal roll |
| `cover-bins` | nibble mid hit — holes low/high/top |
| `sva-timeline` | overlap pass @ cycle 2 (a=1, b=1) |
| `vif-wiring` | UART uart_if — declare + instance + DUT wired |
| `self-check-tb` | and2 a=1,b=1 expect y=1 — PASS |
| `tb-clock-reset` | classic: rst_n low ×2 posedges, then sync release |
| `file-vector-io` | starter and2 — 4 stim/exp vectors, Apply all PASS |
| `tb-layers` | starter: 1 agent + scoreboard under env |
| `uvm-phases` | starter: cursor on run, objection raised |
| `uvm-factory` | starter: base_driver → error_driver type override |
| `uvm-configdb` | starter: set vif @ env.agent, get from drv |
| `uvm-objections` | starter: test raised — run held open |
| `uvm-seq-flow` | starter: UART 0xA5 item at sequencer |
| `uvm-agent` | starter: active agent, driver selected |
| `uvm-tlm` | starter: seq_item + analysis both up |
| `uvm-scoreboard` | starter: match 0xA5 expect/actual |
| `ral-map` | starter: CTRL @ 0x00 front-door write 1 |
| `cocotb-uvm-map` | starter: DUT handle ↔ vif mapped |
| `uvm-reporting` | starter: INFO DRV @ LOW → shown |
| `uvm-callbacks` | starter: err_inj on pre_drive armed |
| `uvm-vseq` | starter: UART then SPI sequential |
| `uvm-multi-agent` | starter: UART+SPI → shared sb |
| `protocol-checker` | starter: clean valid∧ready, data `0xA5` — all rules PASS |
| `vip-anatomy` | starter: UART VIP — agent+checker+coverage+docs COMPLETE |
| `uvm-plusargs` | starter: `+UVM_TESTNAME=base_test +SEED=1` — test selected |
| `cocotb-triggers` | starter: `await RisingEdge(clk)` fires at t=10 |
| `cocotb-dut-handle` | starter: `dut.uart.txd` resolves — value `1` |
| `pytest-assert-lab` | expect `0xA5` == actual → PASS |
| `stim-as-data` | 4 AND vectors — Apply all PASS |
| `cocotb-clock-helper` | period 10 → edges 10/20/30 |
| `cocotb-binary-value` | 8-bit `0xA5` → `10100101` |
| `cocotb-scoreboard` | expect `0xA5`, observe match → PASS |
| `assert-assume-cover` | 3 statements correctly tagged |
| `formal-bmc-bound` | bug@3, k=5 → CEX |
| `formal-counterexample` | cursor on failing cycle |
| `formal-induction` | base+step hold → proved sketch |
| `formal-vacuity` | `a|->b` with a always 0 → vacuous |
| `python-async-tb` | starter: `@cocotb.test` + `async def` + `await Timer(10)` — DONE |
| `verif-plan-check` | starter: UART TX → send one byte → `tx_byte_done` — COMPLETE |
| `feature-matrix` | starter: UART TX/RX × byte/idle/err — no gaps |
| `coverage-closure` | starter: hole `mid` → idea `directed mid samples` — READY |
| `regression-triage` | starter: uart→fail, spi→flake, i2c→new — CLEAN |
| `test-taxonomy` | starter: uart_byte→directed … parity_bad→corner — BALANCED |
| `risk-plan` | starter: H×H→P0, M×H→P0, L×M→P2, L×L→defer — ALIGNED |
| `signoff-checklist` | starter: coverage + bug bar + stability met — READY |
| `seed-tags` | starter: seed 42 + uart_byte config + smoke,nightly — REPLAYABLE |
| `ci-farm-flow` | starter: local → CI → farm all pass — READY |
| `vip-handoff` | starter: docs + API + self-test met — READY |
| `sim-pipeline` | starter: compile → elaborate → run all pass — READY |
| `wave-dump` | starter: long_farm → FST dump on — MATCHED |
| `dpi-cpp-tb` | starter: verilator_cpp model + eval loop — READY |
| `iverilog-vs-verilator` | starter: long_regression → Verilator — MATCHED |
| `verif-metrics` | starter: pass 98% · cov 95% · escape 0 — HEALTHY |
| `iverilog-flags` | starter: `-g2012 -Wall -o sim.vvp +incdir+include tb.v dut.v` — READY |
| `iverilog-timescale` | starter: `` `timescale 1ns/1ps `` · `#10` → 10 ns — ALIGNED |
| `vvp-plusargs` | starter: `vvp sim.vvp +SEED=1 +VERBOSE` — READY |
| `verilator-lint-lab` | starter: `-Wall` on · findings fixed — CLEAN |
| `verilator-trace` | starter: `--trace` · VCD · open+dump — READY |
| `verilator-public` | starter: `u_core.state` public — VISIBLE |
| `hdl-sim-tour` | starter: all five panes visited — ORIENTED |
| `hdl-sim-hello-dut` | starter: counter · Run→Stop→Reset — READY |
| `hdl-sim-step-continue` | starter: Step + Continue→bp@5 — READY |
| `hdl-sim-poke-force` | starter: poke + force→release on data — READY |
| `hdl-sim-waves` | starter: clk+q · C1@5 C2@10 · q hex — WATCHING |
| `hdl-sim-multi-file` | starter: tb top · WIDTH=8 · incdir include — LINKED |
| `hdl-sim-compare-golden` | starter: compare @ C1=5 · JSON + VCD — MATCHED |
| `i2c-open-drain` | ACK — slave pulls SDA low, master releases |
| `i2c-clock-stretch` | ACK then SCL held low ×3 — master waits |
| `i2c-repeated-start` | Sr write-pointer then read @ 0x50 |
| `baud-divider` | DIV=4 pulse — tick every 4 sysclks |
| `spi-cpol-cpha` | Mode 0 — sample ↑ change ↓ |
| `seq-detector` | Mealy overlap detect `1011` â€” step stream â†’ Z=`0001` |
| `fsm-lab` | Moore toggle â€” step `1011`, Z follows S0/S1 |
| `handshake` | validâˆ§ready on cycle 0 with data `0xA5` â†’ one beat |
| `tb-anatomy` | `and2` DUT + `reg a,b` / `wire y`; `$display` then `$finish` |
| `waveform-lab` | D-FF session; poke `D=1` â†’ â†—posedge; click cursor on live waves |
| `module-diagram` | `and2` ports `a`,`b`â†’`y`; hierarchy preset with instance `u0` |
| `reset-timelines` | Twin sync/async FFs; mid-cycle `rst_n=0` â†’ async clears, sync holds |
| `setup-hold` | Clean pass starter; drag DÎ”; green/red `tsu`/`th` windows |
| `shell-history` | History already has a UART project session; Ctrl+R → `make` recalls `make test` |
| `path-abs-rel` | Cwd `~/projects/uart_tx`; resolve `../spi_master/src` vs `~/…` vs absolute |
| `wildcards-globs` | Pattern `*.txt`; try `data_?.log` vs `data_*.log`; `*` skips `.gitignore` |
| `man-help-lab` | Run `man ls`, page with Space, `/recursive`, then `ls --help` / `apropos copy` |

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
- [SystemVerilog design constructs](#systemverilog-design-constructs)
- [Combinational design hygiene](#combinational-design-hygiene)
- [Clocks, registers & timing](#clocks-registers--timing)
- [Waveforms & debug literacy](#waveforms--debug-literacy)
- [FSM & control](#fsm--control)
- [Arithmetic & datapath](#arithmetic--datapath)
- [Memory, FIFO & cache](#memory-fifo--cache)
- [Hierarchy, buses & integration](#hierarchy-buses--integration)
- [Coding standards & synthesizability](#coding-standards--synthesizability)
- [Protocols (conceptual)](#protocols-conceptual)
- [SV testbench & assertions (conceptual)](#sv-testbench--assertions-conceptual)
- [UVM 2017 methodology (sketches)](#uvm-2017-methodology-sketches)
- [Python & cocotb (conceptual)](#python--cocotb-conceptual)
- [Formal verification (conceptual)](#formal-verification-conceptual)
- [Verification planning (lightweight)](#verification-planning-lightweight)
- [Simulation literacy (conceptual)](#simulation-literacy-conceptual)
- [Browser HDL simulator (guided)](#browser-hdl-simulator-guided)
- [Out of scope (offline only)](#out-of-scope-offline-only)
- [Build phases](#build-phases)
- [Cross-reference (courses â†’ domains)](#cross-reference-courses--domains)
- [Course-by-course gap notes](#course-by-course-gap-notes)

---

## Shell & filesystem

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Virtual filesystem terminal | `vfs-terminal` | **Shipped** | `pwd`, `ls`/`-a`, globs, `less`, `man`, `ln -s`, `head`/`tail`/`wc`; 22 challenges |
| Permissions, umask, PATH & ownership | `permissions` | **Shipped** | Modes, umask, `which`/PATH, owner/group, `export`; 22 challenges |
| Shell history & reverse-search | `shell-history` | **Shipped** | `history`, up/down arrows, Ctrl+R reverse-search, line-edit keys, `!!`/`!n`/`!$`; starter UART session; 22 challenges |
| Absolute vs relative paths | `path-abs-rel` | **Shipped** | `/`, `~`, `.` / `..`; resolve against cwd; when relative breaks after `cd`; 22 challenges |
| Glob / wildcard lab | `wildcards-globs` | **Shipped** | `*`, `?`, character classes; expand before command; leading-dot pitfall; 22 challenges |
| man / --help discoverability | `man-help-lab` | **Shipped** | `man` pager (Space/b//q), `--help`, `whatis`, `apropos` / `man -k`; 22 challenges |
| File types & links | `file-types-lab` | **Shipped** | `ls -l` type letters; soft vs hard links; broken symlink; starter design tree; 22 challenges |
| realpath / readlink | `realpath-resolve` | **Shipped** | `readlink` vs `realpath` / `readlink -f`; relative link base; chains; broken links; 22 challenges |
| Dotfiles & config homes | `dotfiles-lab` | **Shipped** | `ls` vs `ls -a`; `~` configs (`.bashrc`, `.gitconfig`, `.config/`); project `.gitignore`; 22 challenges |

## Processes & text

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pipes, redirection, xargs & jobs | `pipes` | **Shipped** | `\|`, redirects, `tee`, `xargs`, jobs; 22 graded challenges |
| Process list & signals | `ps-kill-lab` | **Shipped** | `ps`, Ctrl+C / `kill`, SIGINT vs SIGTERM vs SIGKILL; hung process needs `-9`; 22 challenges |
| Job control deep-dive | `job-control-lab` | **Shipped** | Ctrl+Z (SIGTSTP), `jobs` / `fg` / `bg`, `&` background; state timeline; 22 challenges |
| sort / uniq / cut | `sort-uniq-cut` | **Shipped** | `sort`/`-n`/`-u`, `uniq`/`-c`, `cut -d`/`-f`/`-c`; log pipelines; 22 challenges |
| Here-doc / here-string | `here-doc-lab` | **Shipped** | `<<EOF` vs `<<'EOF'`; `<<<` here-string; cat/grep/wc/read; 22 challenges |

## Scripting

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Script exit codes & control flow | `scripting` | **Shipped** | Args, `if`/`for`/`case`, alias, functions, `read`, `set -e`; 23 challenges |
| Exit status & `&&` / `\|\|` | `exit-status-lab` | **Shipped** | `$?`, `&&`/`\|\|` short-circuit, `A && B \|\| C` pitfall, `set -e` demo; 22 challenges |
| Alias & function lab | `alias-lab` | **Shipped** | alias vs function; `type`; session vs pretend `.bashrc` (`save-rc` / `new-shell`); 22 challenges |
| Safe scripting checklist | `safe-scripting` | **Shipped** | `set -euo pipefail`, quoting, `--dry-run`; interactive checklist + scenarios; 22 challenges |

## Projects & archives

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Project layout, archives, sed & diff | `project-archives` | **Shipped** | Tree, find/grep, tar, sed, diff/patch; 22 challenges |
| tar vs zip | `zip-vs-tar` | **Shipped** | When to use tar.gz vs zip; exclude build/logs/.git; create/list; 22 challenges |
| Backup & clean-build | `backup-clean` | **Shipped** | Timestamped backup before clean; safe vs keep paths; dry-run; 22 challenges |
| Relative symlink pitfalls | `link-relative` | **Shipped** | Relative vs absolute when trees/links/targets move; 22 challenges |

## Version control

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Git graph, staging, stash & rebase | `git-graph` | **Shipped** | Status, add/commit, merge/rebase, cherry-pick, stash, tags, ignore; 22 challenges |
| Merge conflict resolver | `git-conflicts` | **Shipped** | Conflict markers; ours / theirs / manual; 22 scenarios |
| Blame & bisect | `blame-bisect` | **Shipped** | Line attribution; binary search for first bad commit; 22 challenges |
| Remotes, PRs & submodules | `remotes` | **Shipped** | 22-question concept quiz + live GitHub checklist (clone, Make, push, PR, submodule) |
| `.gitignore` pattern lab | `gitignore-lab` | **Shipped** | Glob patterns vs build/sim/log artifacts; negation & root-anchor; 22 challenges |
| Safe Git undo | `git-undo-safe` | **Shipped** | Unstage / restore / soft vs mixed vs hard; force-push risk; 22 challenges |
| Git mental model | `git-mental-model` | **Shipped** | Working tree ↔ index ↔ HEAD diagram; add/commit/restore flows; 22 challenges |
| `git log` options | `git-log-lab` | **Shipped** | `--oneline` / `--graph` / decorate / path / author / grep; 22 challenges |
| Stash scenarios | `git-stash-lab` | **Shipped** | push / pop / apply / drop / -u / clear; dirty-tree saves; 22 challenges |
| Tags (light vs annotated) | `git-tags-lab` | **Shipped** | Lightweight vs annotated; show/delete/push --tags; 22 challenges |
| Reflog recovery | `git-reflog` | **Shipped** | Recover “lost” commits after reset; HEAD@{n}; recovery branch; 22 challenges |
| Rebase vs merge chooser | `git-rebase-merge` | **Shipped** | When to rebase vs merge (no interactive); 8 scenarios; 22 challenges |
| Cherry-pick lab | `git-cherry-pick-lab` | **Shipped** | Pick one commit across branches; clean vs conflict; continue/abort; 22 challenges |
| Branch naming strategy | `branch-strategy` | **Shipped** | `feature/` / `fix/` / `hotfix/` conventions; base from main; 22 challenges |
| Remote-tracking branches | `remote-tracking` | **Shipped** | `origin/main` vs local; fetch vs pull; ahead/behind; 22 challenges |
| PR review checklist | `pr-review-lab` | **Shipped** | Review culture: size, tests, diff hygiene; 8 PRs; 22 challenges |
| Submodule pitfalls | `submodule-pitfalls` | **Shipped** | Detached HEAD, forgotten init, pin updates; 22 challenges |
| Commit message lab | `commit-message-lab` | **Shipped** | Subject/body; why over what; validate style; 22 challenges |

## Workflow & submission

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Pre-push checklist, Make & env | `workflow` | **Shipped** | `check_ready`, `make test`, `.env`, dry-run clean; 22 challenges |
| Log / failure triage | `log-triage` | **Shipped** | Make/sim logs → fail vs env vs flake; 12 cases; 22 challenges |
| Makefile basics | `make-basics` | **Shipped** | Targets, deps, `.PHONY`, variables; rebuild lab; 22 challenges |
| `.env` file literacy | `env-file-lab` | **Shipped** | Load order; secrets vs committed config; 22 challenges |
| Template-repo bootstrap | `template-clone` | **Shipped** | Clone template → inspect layout → first status; 22 challenges |
| Dry-run mindset | `dry-run-lab` | **Shipped** | `--dry-run` / echo-first before destructive cmds; 22 challenges |
| Submission reproducibility | `submission-repro` | **Shipped** | Clean tree, scripts from root, log capture; 22 challenges |

---

## Number systems & representation

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Radix / bit-width converter | `radix-converter` | **Shipped** | HDL `Value` / `parseLiteral`; starter `0x2A`; overflow; 22 challenges |
| Verilog literal decoder | `verilog-literals` | **Shipped** | HDL `parseLiteral`; starter `8'h2A`; 28 challenges; X/Z/? |
| Two’s complement lab | `twos-complement` | **Shipped** | Signed range, negate, wrap intuition; 22 challenges |
| Gray code converter | `gray-code` | **Shipped** | Binary ↔ Gray; why async FIFO uses it; 22 challenges |
| BCD encode / decode | `bcd-lab` | **Shipped** | Binary-coded decimal packing; 22 challenges |
| Parity / XOR checksum | `parity-checksum` | **Shipped** | Even/odd parity; reduction XOR; 22 challenges |
| Fixed-point Qm.n | `fixed-point` | **Shipped** | Integer vs fractional bits; encode/decode; 22 challenges |
| Bit-field extract / insert | `bit-fields` | **Shipped** | Slice, mask, pack fields into a word; 22 challenges |
| Endian packing | `endian-lab` | **Shipped** | Big vs little byte order in words; 22 challenges |
| Overflow / wrap-around | `overflow-wrap` | **Shipped** | Modular width arithmetic hazards; 22 challenges |
| ASCII / hex dump literacy | `ascii-hex` | **Shipped** | Bytes as hex vs printable ASCII; 22 challenges |

## Boolean algebra & minimization

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Truth-table builder | `truth-table` | **Shipped** | Fills via public HDL `createCombEvaluator`; starter `A & B`; SOP/POS; 22 challenges |
| K-map minimizer (2â€“6 vars) | `kmap` | **Shipped** | Gray-coded map; 5â€“6 var MSB planes; 0/1/X; auto groups + minimal SOP; 26 challenges |
| Boolean law playground | `boolean-laws` | **Shipped** | Step-through De Morgan & algebra rewrites; starter `~(AÂ·B)`; 22 challenges |
| SOP ↔ POS converter | `sop-pos` | **Shipped** | Dual forms from the same table; 22 challenges |
| Don’t-care minimization | `dont-care-lab` | **Shipped** | X entries that shrink cover; 22 challenges |
| Static / dynamic hazards | `logic-hazards` | **Shipped** | Glitch intuition on multi-level logic; 22 challenges |

## Gates & combinational blocks

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Gate composer | `gate-composer` | **Shipped** | HDL `createGateNetEvaluator`; schematic; 29 challenges |
| Mux / decoder / encoder explorer | `mux-decoder` | **Shipped** | Mux 2:1â€“16:1; decode 2â†’4â€“4â†’16; priority encode 4â†’2 / 8â†’3; 28 challenges |
| Priority encoder & comparator | `priority-compare` | **Shipped** | High/low priority + EI/EO cascade; unsigned vs signed compare flags; 22 challenges |
| Half / full adder builder | `half-full-adder` | **Shipped** | HA → FA → ripple chain building blocks; 22 challenges |
| XOR parity tree | `xor-parity-tree` | **Shipped** | Reduction tree / parity generator; 22 challenges |
| Tri-state / bus contention | `tri-state-bus` | **Shipped** | High-Z, enable, multi-driver risk; 22 challenges |
| Barrel shifter | `barrel-shifter` | **Shipped** | Shift/rotate by select amount; 22 challenges |
| Seven-segment decoder | `seven-segment` | **Shipped** | Hex nibble → 7-seg pattern; 22 challenges |

## HDL structure & operators

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Module / port diagram | `module-diagram` | **Shipped** | HDL `parse` â†’ modules, ports, instances; clickable port diagram; 22 challenges |
| Classic `wire` vs `reg` | `wire-vs-reg` | **Shipped** | Net vs variable in IEEE 1364; when each is legal; 22 challenges |
| Operator playground | `sv-operators` | **Shipped** | Bitwise vs logical, concat/replicate, reduction, shifts; HDL `parseLiteral`; 22 challenges |
| Parameter / width explorer | `param-width` | **Shipped** | `#(.WIDTH(N))`, `$clog2(DEPTH)`, derived buses; 22 challenges |
| Generate / replication explorer | `sv-generate` | **Shipped** | `for`/`if` generate, `genvar`, instance arrays; 22 challenges |
| Typedef / enum / packed struct | `sv-typedefs` | **Shipped** | `typedef`, enum encodings, packed vs unpacked layouts; 22 challenges |
| ANSI vs non-ANSI ports | `ansi-ports` | **Shipped** | 1995 port list vs 2001 ANSI header side-by-side; 22 challenges |
| Named vs positional connections | `named-vs-positional` | **Shipped** | `.port(sig)` vs order — mismatch hazards; 22 challenges |
| localparam vs parameter | `localparam-lab` | **Shipped** | Override rules; why `defparam` is deprecated; 22 challenges |
| Multi-dimensional arrays | `multi-dim-arrays` | **Shipped** | Packed vs unpacked layout visualizer; 22 challenges |
| bit vs logic (2-state / 4-state) | `bit-vs-logic` | **Shipped** | X/Z propagation vs TB 2-state choice; 22 challenges |
| Signed / unsigned width | `signed-width` | **Shipped** | `$signed` / `$unsigned`, compare & extend pitfalls; 22 challenges |
| One-driver / multi-driver | `one-driver` | **Shipped** | Contested nets; why single-driver RTL; 22 challenges |

## SystemVerilog design constructs

Browser literacy for SV **RTL** idioms from `learn_verilog_systemverilog` / digital courses. Not a full IEEE LRM or simulator.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| always_comb / always_ff / always_latch | `sv-always-procs` | **Shipped** | Procedural intent vs legacy `always @`; latch vs FF cues; 22 challenges |
| unique / priority case | `sv-case-unique` | **Shipped** | Overlap / incomplete case semantics; 22 challenges |
| Interface + modport sketch | `sv-interfaces` | **Shipped** | Signal bundle + direction per role; 22 challenges |
| Package / import explorer | `sv-packages` | **Shipped** | What belongs in `package` vs module; `import` scope; 22 challenges |
| IEEE construct → version map | `ieee-version-map` | **Shipped** | Which IEEE adds `logic`, `always_ff`, interface, …; 22 challenges |
| 1364 → 1800 migration quiz | `sv-migration` | **Shipped** | Side-by-side idiom checklist (wire/reg → logic, etc.); 22 challenges |
| `inside` / wildcard equality | `sv-inside` | **Shipped** | `inside` sets and `==?` / `!=?`; 22 challenges |
| Checker / bind sketch | `sv-checker` | **Shipped** | Reusable property block vs synthesizable module; 22 challenges |

## Combinational design hygiene

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Combo style / latch-risk checker | `latch-risk` | **Shipped** | `assign` vs incomplete `always`/`case`; inferred latch verdict; 22 challenges |
| Sensitivity-list explorer | `sensitivity-list` | **Shipped** | Teaching model: poke signals â†’ run/skip log; `@(*)` vs incomplete vs posedge/async; 22 challenges |

## Clocks, registers & timing

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Clock-edge stepper | `clock-stepper` | **Shipped** | 8 labs (D-FF Â· T-FF Â· enable Â· counters Â· shift Â· pipeline Â· load); signal trace; 22 challenges |
| Blocking vs non-blocking | `blocking-vs-nonblocking` | **Shipped** | Side-by-side `=` vs `<=` (swap Â· pipeline Â· chain Â· RHS Â· 3-stage); 20 challenges |
| Reset strategy timelines | `reset-timelines` | **Shipped** | Sync vs async twin sessions; mid-cycle reset divergence; timeline waves; 22 challenges |
| Setup / hold explainer | `setup-hold` | **Shipped** | Annotated tsu/th windows; drag data transition; violation presets; 22 challenges |
| CDC / 2-FF synchronizer | `cdc-sync` | **Shipped** | Metastability concept + two-flop chain; 22 challenges |
| Clock enable vs gated clock | `clock-enable` | **Shipped** | CE on D-path vs AND-on-clk risk; 22 challenges |
| Shift-register lab | `shift-register-lab` | **Shipped** | SISO / SIPO / PISO / PIPO step-through; 22 challenges |
| Counter lab | `counter-lab` | **Shipped** | Up / down / modulo / enable / Gray; 22 challenges |

## Waveforms & debug literacy

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Waveform lab | `waveform-lab` | **Shipped** | HDL session waves; SVG viewer + cursor; signal watch list; D-FF starter; 22 challenges |
| Testbench anatomy explorer | `tb-anatomy` | **Shipped** | DUT vs tb anatomy; reg/wire/logic roles; `$display`/`$finish` timeline; 22 challenges |
| Task vs function vs always | `task-vs-function` | **Shipped** | Timing / return / synthesis roles; 22 challenges |
| Fork / join sketch | `fork-join` | **Shipped** | join / join_any / join_none timeline; 22 challenges |
| Delay / event / wait | `delay-event-wait` | **Shipped** | `#delay`, `@event`, `wait` timeline; 22 challenges |
| GTKWave cursor literacy | `gtkwave-cursors` | **Shipped** | Markers, zoom, signal add (UI literacy — not GTKWave itself); 22 challenges |

## FSM & control

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| FSM designer + stepper | `fsm-lab` | **Shipped** | Presets + editable table; Moore/Mealy; step stream; 22 challenges |
| State encoding lab | `state-encoding` | **Shipped** | Binary / one-hot / Gray; FF count + transition Hamming; 22 challenges |
| Sequence detector playground | `seq-detector` | **Shipped** | Step bit stream; Mealy/Moore; overlap; pattern `1011`; 22 challenges |
| Ring / Johnson counter | `ring-johnson` | **Shipped** | Circulating one-hot / twisted-ring; 22 challenges |
| LFSR / PRBS stepper | `lfsr-lab` | **Shipped** | Tap polynomial → sequence; period intuition; 22 challenges |

## Arithmetic & datapath

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Ripple-carry adder animator | `ripple-carry-adder-animator` | **Shipped** | FA chain, step carry LSBâ†’MSB; 4/8-bit; 22 challenges |
| Carry-lookahead generate & propagate | `carry-look-ahead-adder-propagate-and-generate` | **Shipped** | Gáµ¢/Páµ¢ table + expanded carries; 4/8-bit; 22 challenges |
| Array multiplier grid | `array-mult` | **Shipped** | Partial-product AND grid + product; 3Ã—3 / 4Ã—4; 22 challenges |
| ALU operation explorer | `alu-explorer` | **Shipped** | Opcode â†’ Y plus flags Z/N/C/V; 4/8-bit; 22 challenges |
| Carry-select adder sketch | `carry-select-adder` | **Shipped** | Dual path + mux on carry-in; 22 challenges |
| Booth encode grid | `booth-encode` | **Shipped** | Radix-4 Booth partial-product reduction; 22 challenges |
| Signed arithmetic / overflow | `signed-arith` | **Shipped** | Two’s complement add/sub + overflow flags; 22 challenges |

## Memory, FIFO & cache

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| RAM / ROM address map | `mem-map` | **Shipped** | 16Ã—8 map; R/W highlights; `$readmemh`-style load; 22 challenges |
| FIFO pointer & flags | `fifo-lab` | **Shipped** | Sync FIFO: wr/rd pointers, count, empty/full; depth 4/8; 22 challenges |
| Cache hit/miss walkthrough | `cache-walk` | **Shipped** | Direct-mapped tag/index/offset; hit/miss + install; 22 challenges |
| Dual-port RAM | `dual-port-ram` | **Shipped** | Independent R/W addresses; collision cases; 22 challenges |
| Byte-enable memory | `byte-enable-mem` | **Shipped** | Partial-word writes with byte enables; 22 challenges |
| Async FIFO (Gray pointers) | `async-fifo` | **Shipped** | Cross-clock empty/full with Gray sync; 22 challenges |

## Hierarchy, buses & integration

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Block-diagram integrator | `block-diagram` | **Shipped** | Click-to-wire CPU/ALU/RegFile/Memory/Bus; typed ports; 22 challenges |
| Bus handshake animator | `handshake` | **Shipped** | valid/ready fire; source/sink stall presets; 22 challenges |
| Pipeline stall / forward | `pipeline-hazards` | **Shipped** | Data hazard → stall or forward; 22 challenges |

## Coding standards & synthesizability

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Synthesizability linter (static) | `synth-lint` | **Shipped** | HDL engine `lintSynthesizability`; `#delay` / latch / FF style; 22 challenges |
| Naming / style checker | `hdl-style` | **Shipped** | HDL engine `lintStyle`; live hints + Tab assist; `clk`/`rst_n`, `always_ff`/`always_comb`, `logic`; Fix buttons; same API as IDE Problems; 22 challenges |

## Protocols (conceptual)

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| UART frame animator | `uart-frame` | **Shipped** | Start/data/parity/stop timeline; 22 challenges |
| UART oversampling | `uart-oversample` | **Shipped** | 16× mid-bit sample / majority / start center; 22 challenges |
| UART error cases | `uart-errors` | **Shipped** | Framing / parity / overrun; 22 challenges |
| SPI transaction stepper | `spi-step` | **Shipped** | Mode 0 CS/SCLK/MOSI/MISO byte step; 22 challenges |
| SPI multi-CS / daisy | `spi-multi-cs` | **Shipped** | Independent CS vs daisy-chain; 22 challenges |
| I²C start/addr/ack explorer | `i2c-lab` | **Shipped** | Start, address+R/W, ACK/NACK; 22 challenges |
| I²C clock stretch | `i2c-clock-stretch` | **Shipped** | Slave holds SCL low; master waits; 22 challenges |
| I²C repeated start | `i2c-repeated-start` | **Shipped** | Sr vs Stop+Start; read-after-write; 22 challenges |
| Baud / clock divider | `baud-divider` | **Shipped** | Sysclk → baud_tick / clk_div; 22 challenges |
| SPI CPOL/CPHA modes | `spi-cpol-cpha` | **Shipped** | Mode 0–3 edge capture/change matrix; 22 challenges |
| I²C open-drain model | `i2c-open-drain` | **Shipped** | Open-drain vs push-pull; wired-AND; 22 challenges |
| Spec → RTL checklist | `spec-to-rtl` | **Shipped** | SPEC ports/blocks → RTL skeleton; 22 challenges |
| Basic TB vs UVM map | `tb-vs-uvm-map` | **Shipped** | Wiggle-pins vs transaction/agent; 22 challenges |

## SV testbench & assertions (conceptual)

Literacy for `learn_verilator_iverilog` Modules 3â€“7 and SV TB intros. **Not** a class runtime, CRV engine, or SVA simulator.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Class / inheritance sketch | `sv-class-sketch` | **Shipped** | TB OOP roles (object vs component); 22 challenges |
| Constraint / random lite | `crv-lite` | **Shipped** | Dice + simple constraint visualize; 22 challenges |
| Coverpoint / bins sketch | `cover-bins` | **Shipped** | Coverpoint → bins → holes; 22 challenges |
| SVA implication timeline | `sva-timeline` | **Shipped** | Overlap `|->` / next `|=>` on a short wave; 22 challenges |
| Virtual interface wiring | `vif-wiring` | **Shipped** | Class TB to DUT via interface + virtual handle; 22 challenges |
| Self-checking TB pattern | `self-check-tb` | **Shipped** | Stimulus → expect → pass/fail; 22 challenges |
| TB clock + reset patterns | `tb-clock-reset` | **Shipped** | Clock gen + reset assert/deassert; 22 challenges |
| File / vector I/O | `file-vector-io` | **Shipped** | `$readmemh` stim/exp → apply loop; 22 challenges |

## UVM 2017 methodology (sketches)

Concept diagrams for `learn_uvm2017` / `learn_pyuvm`. **Not** a UVM library or Verilator UVM run — sketches align with **IEEE 1800.2-2017** (UVM 2017).

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Testbench layer diagram | `tb-layers` | **Shipped** | Agent / env / scoreboard stack; 22 challenges |
| UVM phase timeline | `uvm-phases` | **Shipped** | build → connect → run → check → report; 22 challenges |
| Factory override sketch | `uvm-factory` | **Shipped** | Type/inst override — who gets constructed; 22 challenges |
| ConfigDB key path | `uvm-configdb` | **Shipped** | set/get by path + field; 22 challenges |
| Objection raise/drop | `uvm-objections` | **Shipped** | Who holds run open; raise/drop; 22 challenges |
| Sequence → driver flow | `uvm-seq-flow` | **Shipped** | item → sequencer → driver → DUT; 22 challenges |
| Agent anatomy | `uvm-agent` | **Shipped** | sequencer / driver / monitor; active vs passive; 22 challenges |
| TLM port wiring | `uvm-tlm` | **Shipped** | seq_item / put / get / analysis; 22 challenges |
| Scoreboard expect/actual | `uvm-scoreboard` | **Shipped** | predict vs observe compare; orphans; 22 challenges |
| Register model map | `ral-map` | **Shipped** | block→reg→field; front-door vs back-door; 22 challenges |
| cocotb vs UVM map | `cocotb-uvm-map` | **Shipped** | pyuvm / cocotb ↔ SV UVM roles; 22 challenges |
| UVM reporting ladder | `uvm-reporting` | **Shipped** | severity / verbosity / ID filter; 22 challenges |
| Callbacks sketch | `uvm-callbacks` | **Shipped** | pre/post hooks without subclassing; 22 challenges |
| Virtual sequence | `uvm-vseq` | **Shipped** | vsequencer refs · seq vs parallel; 22 challenges |
| Multi-agent env | `uvm-multi-agent` | **Shipped** | two+ agents · shared scoreboard fan-in; 22 challenges |
| Protocol checker sketch | `protocol-checker` | **Shipped** | bus rules vs scoreboard roles; 22 challenges |
| VIP anatomy | `vip-anatomy` | **Shipped** | agent + checker + coverage + docs package; 22 challenges |
| Plusargs / CLP | `uvm-plusargs` | **Shipped** | `+UVM_TESTNAME` and test knobs; 22 challenges |
| cocotb triggers | `cocotb-triggers` | **Shipped** | RisingEdge / Timer / First / Combine; 22 challenges |
| cocotb DUT handle | `cocotb-dut-handle` | **Shipped** | hierarchical dut.path · .value peek/poke; 22 challenges |

### Python & cocotb (conceptual)

Literacy for `learn_python_hw` / `learn_cocotb`. **Not** a full simulator or cocotb runner.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Python async TB sketch | `python-async-tb` | **Shipped** | `async def` test + await timeline; 22 challenges |
| Stimulus as data | `stim-as-data` | **Shipped** | Vector table rows / Apply all; 22 challenges |
| pytest assert / golden | `pytest-assert-lab` | **Shipped** | expect vs actual / golden compare; 22 challenges |
| cocotb Clock helper | `cocotb-clock-helper` | **Shipped** | Clock.start edge timeline; 22 challenges |
| cocotb BinaryValue | `cocotb-binary-value` | **Shipped** | width + value → bits; 22 challenges |
| cocotb scoreboard | `cocotb-scoreboard` | **Shipped** | expect queue vs observe; 22 challenges |

## Formal verification (conceptual)

Literacy for `learn_formal`. **Not** a commercial formal engine or SymbiYosys replacement.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Assert / assume / cover | `assert-assume-cover` | **Shipped** | Property roles; 22 challenges |
| Formal BMC bound | `formal-bmc-bound` | **Shipped** | Bound k vs bug depth; 22 challenges |
| Formal counterexample | `formal-counterexample` | **Shipped** | Step a short CEX; 22 challenges |
| Formal induction sketch | `formal-induction` | **Shipped** | Base + step literacy; 22 challenges |
| Formal vacuity | `formal-vacuity` | **Shipped** | Vacuous pass intuition; 22 challenges |

## Verification planning (lightweight)

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Coverage / plan checklist | `verif-plan-check` | **Shipped** | feature → scenario → coverage mapping; 22 challenges |
| Feature × scenario matrix | `feature-matrix` | **Shipped** | traceability grid P/C/gap; 22 challenges |
| Coverage closure planner | `coverage-closure` | **Shipped** | hole → next test idea; 22 challenges |
| Regression triage board | `regression-triage` | **Shipped** | Fail / flake / new / env buckets; 22 challenges |
| Test taxonomy planner | `test-taxonomy` | **Shipped** | Directed / random / stress / corner tiers; 22 challenges |
| Risk-based plan matrix | `risk-plan` | **Shipped** | Risk × impact → P0/P1/P2/defer; 22 challenges |
| Sign-off criteria | `signoff-checklist` | **Shipped** | Exit criteria: coverage, bug bar, stability; 22 challenges |
| Seed / config / tags | `seed-tags` | **Shipped** | Test metadata for replay & triage; 22 challenges |
| CI / farm regression flow | `ci-farm-flow` | **Shipped** | Local → CI → farm stages; 22 challenges |
| VIP handoff checklist | `vip-handoff` | **Shipped** | Docs + API + self-test deliverables; 22 challenges |

## Simulation literacy (conceptual)

Flow literacy for `learn_iverilog` / `learn_verilator` â€” **not** a browser iverilog/Verilator.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Compile → elaborate → run | `sim-pipeline` | **Shipped** | Toolchain stage diagram (iverilog / Verilator); 22 challenges |
| Wave dump literacy | `wave-dump` | **Shipped** | VCD vs FST roles (not GTKWave); 22 challenges |
| C++ TB / DPI sketch | `dpi-cpp-tb` | **Shipped** | Verilator C++ TB vs SV TB paradigms; 22 challenges |
| iverilog vs Verilator chooser | `iverilog-vs-verilator` | **Shipped** | When to pick each tool (matrix quiz); 22 challenges |
| Verification metrics board | `verif-metrics` | **Shipped** | Pass rate, coverage %, bug escape concepts; 22 challenges |
| iverilog flags lab | `iverilog-flags` | **Shipped** | `-g2005`/`-g2012`, `-Wall`, `-o`, `+incdir`; 22 challenges |
| iverilog timescale | `iverilog-timescale` | **Shipped** | `` `timescale `` vs timeunit pitfalls; 22 challenges |
| vvp plusargs | `vvp-plusargs` | **Shipped** | `$test$plusargs` / runtime plusargs; 22 challenges |
| Verilator lint lab | `verilator-lint-lab` | **Shipped** | `-Wall` warning teaching (concept); 22 challenges |
| Verilator trace | `verilator-trace` | **Shipped** | `--trace` → VCD/FST roles; 22 challenges |
| Verilator public | `verilator-public` | **Shipped** | `/*verilator public*/` / hierarchy visibility; 22 challenges |

## Browser HDL simulator (guided)

Guided literacy for [`learn_hdl_simulator`](../syllabus.md#9-learn_hdl_simulator) and the public [HDL Simulator](https://universal-verification-methodology.github.io/systemverilog-simulator/). Concept steps — **not** a second full IDE.

| Tool | Path id | Status | What it teaches |
|------|---------|--------|-----------------|
| Simulator UI tour | `hdl-sim-tour` | **Shipped** | Files / Hierarchy / Signals / Wave / Console map; 22 challenges |
| Hello DUT in browser | `hdl-sim-hello-dut` | **Shipped** | Tiny module → Run / Stop / Reset; 22 challenges |
| Step & continue | `hdl-sim-step-continue` | **Shipped** | Step · Continue · `$stop` / breakpoints; 22 challenges |
| Poke / force / release | `hdl-sim-poke-force` | **Shipped** | Live drive vs force hazards; 22 challenges |
| Full-sim waves | `hdl-sim-waves` | **Shipped** | Add signals · C1/C2 · radix (simulator UI); 22 challenges |
| Multi-file project | `hdl-sim-multi-file` | **Shipped** | Top · defines · `+incdir` · profiles; 22 challenges |
| Golden compare | `hdl-sim-compare-golden` | **Shipped** | Diff @ C1 · JSON/VCD export literacy; 22 challenges |

---

## Out of scope (offline only)

Do **not** implement these as full browser replacements:

- iverilog compile + `vvp` simulation of course examples  
- Verilator `--cc` + C++ build  
- Full GTKWave / large FST/VCD workflows  
- Full SystemVerilog OOP runtime / UVM library / constrained-random engine / coverage databases  
- Synthesis (Yosys, Vivado, DC) and P&R  
- Cycle-accurate protocol VIPs and scoreboards  
- Toolchain installers and CI Make flows  
- Full formal engines (SymbiYosys / Jasper / VC Formal) and proof databases  

Those stay in course repos and local / WSL environments. Browser tools may ship **concept sketches** (phases, TLM wiring, cover bins as checklists) and **link** to sandboxes or docs.

---

## Build phases

Suggested delivery order (platform rebrand, then digital concepts):

| Phase | Focus | Tools |
|-------|--------|--------|
| **A** | Unify hub branding & catalog UX | Rebrand home/tools index to concept domains; keep shipped Shell/Git tools |
| **B** | Digital logic core | `truth-table` (**shipped**), `gate-composer` (**shipped**), `radix-converter` (**shipped**), `verilog-literals` (**shipped**), `clock-stepper` (**shipped**), `blocking-vs-nonblocking` (**shipped**), `kmap` (**shipped**), `mux-decoder` (**shipped**), `state-encoding` (**shipped**), `seq-detector` (**shipped**), `fsm-lab` (**shipped**), `waveform-lab` (**shipped**) |
| **C** | Datapath & memory | `alu-explorer` (**shipped**), `mem-map` (**shipped**), `array-mult` (**shipped**), `ripple-carry-adder-animator` (**shipped**), `carry-look-ahead-adder-propagate-and-generate` (**shipped**), `cache-walk` (**shipped**), `fifo-lab` (**shipped**), `dual-port-ram` (**shipped**), `byte-enable-mem` (**shipped**), `async-fifo` (**shipped**) |
| **D** | HDL hygiene & protocols | `latch-risk` (**shipped**), `sensitivity-list` (**shipped**), `synth-lint` (**shipped**), `hdl-style` (**shipped**), `handshake` (**shipped**), `pipeline-hazards` (**shipped**), `uart-frame` (**shipped**), `uart-oversample` (**shipped**), `uart-errors` (**shipped**), `baud-divider` (**shipped**), `spec-to-rtl` (**shipped**), `spi-step` (**shipped**), `spi-multi-cs` (**shipped**), `spi-cpol-cpha` (**shipped**), `i2c-lab` (**shipped**), `i2c-clock-stretch` (**shipped**), `i2c-repeated-start` (**shipped**), `i2c-open-drain` (**shipped**) |
| **E** | SV design constructs | `sv-always-procs`, `sv-case-unique`, `sv-interfaces`, `sv-packages`, `sv-generate`, `sv-typedefs`, `ieee-version-map`, `sv-migration` |
| **F** | Verification literacy | `tb-anatomy` (**shipped**), `tb-vs-uvm-map` (**shipped**), `sv-class-sketch` (**shipped**), `crv-lite` (**shipped**), `cover-bins` (**shipped**), `sva-timeline` (**shipped**), `vif-wiring` (**shipped**), `self-check-tb` (**shipped**), `tb-clock-reset` (**shipped**), `file-vector-io` (**shipped**), `tb-layers` (**shipped**), `uvm-phases` (**shipped**), `uvm-factory` (**shipped**), `uvm-configdb` (**shipped**), `uvm-objections` (**shipped**), `uvm-seq-flow` (**shipped**), `uvm-agent` (**shipped**), `uvm-tlm` (**shipped**), `uvm-scoreboard` (**shipped**), `ral-map` (**shipped**), `cocotb-uvm-map` (**shipped**), `cocotb-triggers` (**shipped**), `cocotb-dut-handle` (**shipped**), `python-async-tb` (**shipped**), `uvm-reporting` (**shipped**), `uvm-callbacks` (**shipped**), `uvm-vseq` (**shipped**), `uvm-multi-agent` (**shipped**), `protocol-checker` (**shipped**), `vip-anatomy` (**shipped**), `uvm-plusargs` (**shipped**), SV TB sketches, UVM sketches, `verif-plan-check` (**shipped**), sim literacy |

Phases are planning aids only; the public catalog stays domain-based.

---

## Cross-reference (courses â†’ domains)

Courses **link** to domains; they do not own tools. Target syllabi (lab-driven modules): [`../syllabus.md`](../syllabus.md) (site copy: [`syllabus.md`](syllabus.md)).

| Target course | Primary domains |
|---------------|-----------------|
| `learn_unix` | Shell, Processes, Scripting, Archives, Workflow |
| `learn_git` | Version control, Workflow |
| `learn_digital` | Number systems, Boolean, Gates, Clocks, FSM, Arithmetic, Memory, Hierarchy |
| `learn_verilog` | HDL structure, Combo hygiene, Clocks, Synth/style, FSM/datapath coding |
| `learn_systemverilog` | **SV design constructs**, HDL structure (typedefs/arrays), migration map |
| `learn_uvm2017` | **UVM 2017 sketches**, SV TB sketches, VIP / planning handoff |
| `learn_verilator` | **Simulation literacy** (Verilator), C++/DPI, waves, metrics |
| `learn_iverilog` | **Simulation literacy** (Icarus), waves, self-check TB |
| `learn_hdl_simulator` | **Browser HDL simulator**, waveforms, TB anatomy, synth/style hints |
| `learn_pyuvm` | **UVM sketches**, cocotb triggers / DUT handle, Python async TB |
| `learn_uart` | Protocols (UART+), Spec→RTL, TB vs UVM map |
| `learn_spi` | Protocols (SPI+), Spec→RTL, TB vs UVM map |
| `learn_i2c` | Protocols (I²C+), Spec→RTL, TB vs UVM map |
| `learn_verification_planning_management` | Verification planning, metrics, CI/farm, VIP handoff |
| `learn_python_hw` | Python async TB, stim-as-data, pytest-assert, file/vector I/O |
| `learn_sv_tb` | **SV TB sketches**, CRV / cover / SVA timeline, TB vs UVM map |
| `learn_cocotb` | cocotb triggers / Clock / BinaryValue / scoreboard / DUT, Python async |
| `learn_formal` | **Formal sketches**, SVA timeline, cover, synth/style; SymbiYosys offline |


---

## Course-by-course gap notes

Audit vs [`../syllabus.md`](../syllabus.md) **pass 3** (lab-driven; 2026-07). One syllabus module â‰ˆ one primary lab (+ intro/wrap/offline extras). Browser tools stay **concept literacy**; full sim/UVM/VIP stays offline.

| Target course | Already strong | Gaps (Planned ids) |
|---------------|----------------|--------------------|
| `learn_unix` | vfs → scripting, archives, workflow, make/env labs **shipped** | — |
| `learn_git` | Full Version control + template/submission labs (**all shipped**) | none for browser labs — module 21 stays offline (`unix-git-practice`) |
| `learn_digital` | Numbers→Boolean→gates→clocks→FSM→datapath→mem (**49 labs shipped**; **51 modules with clips/decks**) | — |
| `learn_verilog` | Full IEEE 1364 RTL browser path (**all 17 labs shipped**; **20 modules with clips/decks on platform**) | none for browser labs — module 18 is bridge (reuse digital labs) |
| `learn_systemverilog` | Full SV design browser path (**all 12 labs shipped**; **14 modules with clips/decks on platform**) | none for browser labs — module 13 is wrap |
| `learn_uvm2017` / `learn_pyuvm` | UVM + cocotb/pyuvm sketches (**all shipped**); courses scaffolded | offline fidelity via in-course hellos / module offline |
| `learn_pyuvm` | modules + media ready; pyuvm/cocotb labs + shared `uvm-*` sketches (**all shipped**) | — |
| `learn_verilator` | offline fidelity via in-course hello; course scaffolded; all syllabus browser labs (**shipped**); optional shared `waveform-lab` / `tb-anatomy` | — |
| `learn_iverilog` | shipped TB/wave labs + toolchain (`iverilog-flags` / `iverilog-timescale` / `vvp-plusargs`) + `sim-pipeline` / `wave-dump` / `self-check-tb` (**shipped**); course scaffolded; offline module 11 | — |
| `learn_hdl_simulator` | all **`hdl-sim-*`** + style/synth bridge (**shipped**); course scaffolded under `courses/learn_hdl_simulator/` | free practice = public IDE (module 09) |
| `learn_uart` | shared labs + `self-check-tb` / `tb-vs-uvm-map` / `tb-clock-reset` / `vip-anatomy` (**shipped**); course scaffolded | — |
| `learn_spi` | shared labs + `self-check-tb` / `tb-vs-uvm-map` / `protocol-checker` (**shipped**); course scaffolded | — |
| `learn_i2c` | shared labs + `self-check-tb` / `tb-vs-uvm-map` / `vip-anatomy` (**shipped**); course scaffolded | — |
| `learn_verification_planning_management` | planning shelf + `vip-handoff` / `verif-metrics` (**shipped**); course scaffolded under `courses/learn_verification_planning_management/` | — |
| `learn_python_hw` | `python-async-tb` / `stim-as-data` / `pytest-assert-lab` / `file-vector-io` (**shipped**); modules + media ready | offline venv / deps |
| `learn_sv_tb` | SV TB path + `task-vs-function` / `fork-join` (**all shipped**); modules + media ready | — |
| `learn_cocotb` | cocotb triggers/clock/DUT/BinaryValue/scoreboard + async (**shipped**); modules + media ready | offline cocotb example |
| `learn_formal` | assert/assume/cover + BMC/CEX/induction/vacuity + SVA/cover/synth (**shipped**); modules + media ready | SymbiYosys offline hello |

Still **offline-only** (see Out of scope): installing toolchains, running course Makefiles, full UVM/CRV/SVA engines, commercial VIP, synthesis/P&R.

---

## Counts

| Status | Count |
|--------|------:|
| Shipped | 212 |
| Planned | 0 |
| **Total catalogued** | **212** |

Update this file when a planned tool ships (status → **Shipped**, path verified under `platform/tools/`).
