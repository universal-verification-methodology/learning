# Two learning tracks

## Track A — Real Verilator

Practice with a local Verilator install + C++ / Makefile examples.

- Prompts under each `moduleNN-*/EXAMPLES.md`
- Full examples in [`../learn_verilator_iverilog/`](../learn_verilator_iverilog/)
- Self-check: `./scripts/module.sh NN --check`
- Module 10 is **offline-only** (course Makefile)

## Track B — Browser lab

- Local tools: http://127.0.0.1:8080/tools/
- Live: https://universal-verification-methodology.github.io/learning/tools/
- **Shipped:** `tb-clock-reset`, `sim-pipeline`, `wave-dump`, `dpi-cpp-tb`, `iverilog-vs-verilator`, `verif-metrics`, `verilator-lint-lab`, `verilator-trace`, `verilator-public`
- All syllabus browser labs for this course are **Shipped** (module 10 remains offline-only)
- Optional shared literacy: `waveform-lab`, `tb-anatomy` (shipped elsewhere)

## Recommended path

1. Intro + install Verilator
2. Tool chooser → pipeline → lint / C++ TB / clock-reset
3. Trace, wave dump, public, metrics (browser and/or real runs)
4. Module 10 offline build+run
