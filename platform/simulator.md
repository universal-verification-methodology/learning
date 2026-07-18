# Browser HDL simulator (plan)

Working notes for a **client-side teaching HDL simulator** that can power labs across the learning monorepo and related courses. This is **not** a shipped product yet.

Related: [tools.md](tools.md) (lab catalog), live site tools under `platform/tools/`.

---

## Goal

Build a **workable web-based simulator** that runs entirely in the browser (static hosting / GitHub Pages), so learners can experiment without installing iverilog, Verilator, or a license server.

| We want | We do not claim |
|---------|-----------------|
| Instant, client-side labs | Bit-identical to VCS / Xcelium / full IEEE 1800 |
| Verilog first, then SV **subset** | Full SystemVerilog + UVM in-tab |
| One reusable engine for many courses | Replacement for course Make / CI toolchains |

**Offline fidelity stays offline:** real compile/sim for graded work and LRM-edge cases remains in course repos (iverilog, Verilator, GTKWave, etc.). The browser engine is for **concept labs** and rapid feedback.

---

## Product name (proposed GitHub repo)

**Recommended:** `browser-hdl-sim`  
**Org path:** `universal-verification-methodology/browser-hdl-sim`

| Candidate | Notes |
|-----------|--------|
| **`browser-hdl-sim`** (preferred) | Clear product name; fits webpage + future SV subset |
| `js-verilog-sim` | Honest for v0 (Verilog-only); rename later if needed |
| `hdl-sim-js` | Short; good if published as an npm package |
| `teach-hdl-sim` | Emphasizes teaching / subset |

**README one-liner (suggested):**  
> Client-side teaching HDL simulator (Verilog subset → SystemVerilog subset). Not a commercial LRM replacement.

Avoid names like `full-sv-sim` or `uvm-sim` — they set the wrong expectation.

---

## Architecture split

| Repo | Role |
|------|------|
| **`browser-hdl-sim`** (new, focus first) | Parser, elaborator, sim core, subset docs, unit tests, optional tiny demo page |
| **`learning`** (this monorepo) | Platform UI / tools that **consume** tagged releases of the sim |

Build and harden the simulator **before** wiring every teaching tool to it. Until then, individual labs (e.g. `verilog-literals`) may keep local logic and later switch to the shared library.

```text
Course repos ──link──► learning platform tools (UI)
                              │
                              ▼
                     browser-hdl-sim (engine)
                              │
                              ▼
                     learner’s browser (no server)
```

---

## Non‑negotiable: client-side only

- No upload server, no remote `vvp`, no “simulate in the cloud” dependency for the webpage.
- Engine ships as static JS and/or Wasm with the site or as a package the site bundles.
- Learner work stays in the tab (`localStorage`, download JSON/VCD-subset, etc.).

This matches the platform principle in [tools.md](tools.md): **Client-side only**.

---

## What “workable” means

A **teaching-scale** simulator is realistic and valuable:

1. Literals and values (sized/unsized, bases, `'s`, X/Z)  
2. Wires / `assign` / small combinational nets  
3. Registers, `posedge clk`, simple sequential `always`  
4. Blocking vs non-blocking on a **documented** subset  
5. Tiny testbench hooks (`$display`, `$finish`) and a mini waveform dump  

**Not** in scope for “complete”: full elaborator for all language, classes, randomization, coverage DBs, PLI/DPI, large SoC, commercial timing.

Publish a **Supported subset vN** document from day one. Features not listed → clear error, not silent wrong behavior.

---

## Growth path (Verilog → SV subset)

| Stage | Focus | Example consumers in `learning` |
|-------|--------|----------------------------------|
| **0 (precursor)** | Literal decode (already explored in-tool) | `verilog-literals` |
| **1** | Shared `parseLiteral` / value library + tests | Extract / depend from platform |
| **2** | Combo: expressions, continuous assign | `gate-composer`, truth-table bridges |
| **3** | Cycle sim: FF, counter, NBA vs `=` subset | `clock-stepper`, `blocking-nba`, `fsm-lab` |
| **4** | Mini waveform / event log | `waveform-mini` |
| **5** | Broader Verilog-2001 (params, small generate, …) | More digital / protocol labs |
| **6** | **SV subset** (`logic`, `always_ff` / `always_comb`, optional packed structs) | Still **no** full UVM / CRV |

Stop lines stay explicit: UVM, constrained-random, full OOP, synthesis, P&R remain offline ([tools.md](tools.md) out-of-scope list).

---

## Relationship to current platform tools

Shipped concept labs today are **not** a full simulator. They are stepping stones:

| Tool | Role relative to the sim |
|------|---------------------------|
| `radix-converter` | Number / width intuition |
| `verilog-literals` | Stage‑0 literal decode UX (candidate to call shared lib later) |
| `truth-table` / `gate-composer` | Boolean / gate nets before HDL text |
| Planned: `fsm-lab`, `clock-stepper`, `blocking-nba`, `waveform-mini` | Natural first **engine** consumers once cycle sim exists |

---

## Implementation notes (when the repo starts)

- Prefer a **pure library API** (parse → elaborate → step/run → inspect) so UIs stay thin.  
- **JS interpreter** for the teaching subset is the default path (control + Pages-friendly).  
- **Wasm** (e.g. subset runtime) is optional later for speed/fidelity — still client-side.  
- Golden tests against iverilog for the **claimed subset** are encouraged; gaps must be documented.  
- Follow the platform **starter example** rule for any demo UI ([tools.md](tools.md)).

---

## Source code & licensing (expectations)

Because the engine runs **in the learner’s browser**, shipped code is always downloadable. Obfuscation is not real protection.

| Approach | Use when |
|----------|----------|
| Private GitHub while building v0 | Focus / reduce noise early |
| Public open source (e.g. MIT / Apache-2.0) later | Education org default; reuse + trust |
| Source-available / custom license | If legal review requires limits on commercial forks |

Recommendation: **develop privately if desired; plan to open the engine** when v0 is stable. Brand, docs, and being the maintained upstream matter more than secrecy for a client-side teaching tool.

*(Not legal advice — pick a license with a human review if needed.)*

---

## Near-term plan

1. Create **`universal-verification-methodology/browser-hdl-sim`** and focus there first.  
2. Land **Supported subset v0** + Stage 1 (literals / values) with tests.  
3. Grow Stages 2–4 until cycle sim + waveform are usable.  
4. Return to **`learning`**: depend on a tagged release; migrate tools off duplicated logic.  
5. Only then advertise “browser sim” on the platform home / tools hub.

---

## Status

| Item | Status |
|------|--------|
| Ideas / charter (this file) | **Written** |
| `browser-hdl-sim` repo | **Not created here** (create when ready to build) |
| Integrated platform dependency | **Later** — after engine v0 |
| Full LRM / UVM in browser | **Out of scope** |

Update this file when the external repo exists (add URL), when subset versions ship, or when platform integration starts.
