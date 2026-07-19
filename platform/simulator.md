# Browser HDL simulator

The learning platform consumes the **public** [systemverilog-simulator](https://github.com/universal-verification-methodology/systemverilog-simulator) library build (`assets/engine.mjs`). Source work stays in the private `systemverilog-simulator-src` tree; releases publish the engine + obfuscated IDE.

Related: [tools.md](tools.md), vendor pin [`vendor/systemverilog-simulator/`](vendor/systemverilog-simulator/), loader [`assets/hdl-engine.js`](assets/hdl-engine.js).

---

## Goal

| We want | We do not claim |
|---------|-----------------|
| Instant, client-side labs powered by one engine | Bit-identical to VCS / Xcelium / full IEEE 1800 |
| Many thin tools → one public API | Replacement for course Make / CI toolchains |
| Pin or Pages URL only (no private submodule) | Full UVM in every concept lab |

---

## Architecture

```text
platform/tools/*  ──import──►  assets/hdl-engine.js
                                      │
                    prefer vendor pin │  or public Pages
                                      ▼
                         engine.mjs  (createCombEvaluator, simulate, …)
                                      ▲
                         public release ← private src + build-release
```

| Piece | Role |
|-------|------|
| Private sim repo | `src/`, `createCombEvaluator`, release script |
| Public sim repo | `assets/engine.mjs` + IDE; what tools may depend on |
| `learning` vendor/ | Optional pin until Pages has `engine.mjs`; refresh on each `revN` |

Set `HDL_ENGINE_SPEC.prefer = "public"` in `assets/hdl-engine.js` once Pages serves `engine.mjs`.

---

## Tool adoption

| Tool | Engine use | Status |
|------|------------|--------|
| `truth-table` | `createCombEvaluator` / `evalCombTruthTable` | **Done** |
| `verilog-literals` | `parseLiteral` | **Done** |
| `gate-composer` | `createGateNetEvaluator` | **Done** |
| `radix-converter` | `Value` / `parseLiteral` | **Done** |
| `clock-stepper` | `createSession` (step / runToEdge / poke) | **Done** |
| `blocking-vs-nonblocking` | twin `createSession` (`=` vs `<=`) | **Done** |
| `waveform-mini` / `fsm-lab` | session + waves | Planned |
| `synth-lint` | `lintSynthesizability` / `SYNTH_LINT_RULES` | **Done** |
| `hdl-style` | `lintStyle` / `STYLE_LINT_RULES` | **Done** |

---

## Honesty

- Client-side code is always downloadable; obfuscation of the IDE is not real secrecy.
- Teaching subset ≠ full LRM; unsupported constructs should error clearly.
