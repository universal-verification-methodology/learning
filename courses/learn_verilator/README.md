# learn_verilator

[![GitHub](https://img.shields.io/badge/GitHub-learn__verilator-181717?logo=github)](https://github.com/universal-verification-methodology/learn_verilator)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](LICENSE)
[![Role](https://img.shields.io/badge/role-Git%20submodule-orange)](https://github.com/universal-verification-methodology/learning)
[![Parent](https://img.shields.io/badge/parent-learning%20monorepo-0A9EDC)](https://github.com/universal-verification-methodology/learning)
[![Labs](https://img.shields.io/badge/labs-GitHub%20Pages-222?logo=githubpages)](https://universal-verification-methodology.github.io/learning/tools/)
[![Domain](https://img.shields.io/badge/domain-Verilator%20%7C%20simulation-purple)](https://github.com/universal-verification-methodology/learn_verilator)

**learn_verilator** is the open learning path for *Verilator as a tool*: lint → C++/DPI TB → trace → metrics.

Readers and students usually **open a module README** (or the live tools) or clone this public repo. Authors edit content here (or via the parent monorepo checkout), rebuild slides/audio with **module-slides** in the parent, and push; the parent repo only stores a pinned submodule commit.


## Table of contents

- [Contents](#contents)
- [Browse or clone](#browse-or-clone)
- [Consume from the parent](#consume-from-the-parent)
- [Author: publish or update](#author-publish-or-update)
- [Two learning tracks](#two-learning-tracks)
- [Module landings](#module-landings)
- [Browser labs](#browser-labs)
- [License](#license)

## Contents

```text
learn_verilator/
├── README.md
├── LICENSE
├── docs/
│   ├── MODULES.md       # full module index (00–11)
│   └── TWO_TRACKS.md
├── scripts/
│   └── module.sh
├── module00-intro/
├── module10-offline-verilator-example/
├── …
└── module11-wrap/
```

Videos and decks are optional per module. Generate with the **module-slides** skill in the parent monorepo when ready.

## Browse or clone

- **Browser labs:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)
- **Legacy:** [`learn_verilator_iverilog`](https://github.com/universal-verification-methodology/learn_verilator_iverilog)
- **Syllabus (parent):** [`syllabus.md` § learn_verilator](https://github.com/universal-verification-methodology/learning/blob/main/syllabus.md#7-learn_verilator)

```bash
git clone https://github.com/universal-verification-methodology/learn_verilator.git
cd learn_verilator
chmod +x scripts/*.sh
./scripts/module.sh 10 --check
```

Then open [module00-intro/README.md](module00-intro/README.md).

## Consume from the parent

```bash
git clone --recurse-submodules \
  git@github.com:universal-verification-methodology/learning.git
ls courses/learn_verilator
```

## Author: publish or update

```bash
cd courses/learn_verilator
# … edit module README / CHECKLIST / EXAMPLES / transcript …
cd ../..
python .cursor/skills/module-slides/scripts/transcript_to_outline.py \
  courses/learn_verilator/moduleNN-slug
bash .cursor/skills/module-slides/scripts/narrate_clips.sh \
  courses/learn_verilator/moduleNN-slug
```

## Two learning tracks

Details: [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md).

| Track | Practice surface | Start here |
|-------|------------------|------------|
| **A — Real Verilator** | Local Verilator · [`../learn_verilator_iverilog`](../learn_verilator_iverilog/) | [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md) |
| **B — Browser lab** | Simulation literacy + metrics | [tools index](https://universal-verification-methodology.github.io/learning/tools/) |

Lab status snapshot: **9 shipped** · **0 planned** browser labs; module 10 is offline (see [docs/MODULES.md](docs/MODULES.md)).

## Module landings

Full status table: **[docs/MODULES.md](docs/MODULES.md)**. Clusters: 00 intro · 01–02 chooser/pipeline · 03–05 lint/C++/reset · 06–09 trace/metrics · 10 offline · 11 wrap.

| Module | Landing |
|--------|---------|
| 00 — Welcome to Verilator | [module00-intro](module00-intro/README.md) |
| 01 — iverilog vs Verilator | [module01-iverilog-vs-verilator](module01-iverilog-vs-verilator/README.md) |
| 02 — Compile → elaborate → run | [module02-sim-pipeline](module02-sim-pipeline/README.md) |
| 03 — Verilator lint | [module03-verilator-lint-lab](module03-verilator-lint-lab/README.md) |
| 04 — C++ TB / DPI sketch | [module04-dpi-cpp-tb](module04-dpi-cpp-tb/README.md) |
| 05 — TB clock + reset patterns | [module05-tb-clock-reset](module05-tb-clock-reset/README.md) |
| 06 — Verilator trace | [module06-verilator-trace](module06-verilator-trace/README.md) |
| 07 — Wave dump literacy | [module07-wave-dump](module07-wave-dump/README.md) |
| 08 — Verilator public | [module08-verilator-public](module08-verilator-public/README.md) |
| 09 — Verification metrics | [module09-verif-metrics](module09-verif-metrics/README.md) |
| 10 — Build & run a Verilator example | [module10-offline-verilator-example](module10-offline-verilator-example/README.md) |
| 11 — Verilator track complete | [module11-wrap](module11-wrap/README.md) |

## Browser labs

**Shipped:** [tb-clock-reset](https://universal-verification-methodology.github.io/learning/tools/tb-clock-reset/) · [sim-pipeline](https://universal-verification-methodology.github.io/learning/tools/sim-pipeline/) · [wave-dump](https://universal-verification-methodology.github.io/learning/tools/wave-dump/) · [dpi-cpp-tb](https://universal-verification-methodology.github.io/learning/tools/dpi-cpp-tb/) · [iverilog-vs-verilator](https://universal-verification-methodology.github.io/learning/tools/iverilog-vs-verilator/) · [verif-metrics](https://universal-verification-methodology.github.io/learning/tools/verif-metrics/) · [verilator-lint-lab](https://universal-verification-methodology.github.io/learning/tools/verilator-lint-lab/) · [verilator-trace](https://universal-verification-methodology.github.io/learning/tools/verilator-trace/) · [verilator-public](https://universal-verification-methodology.github.io/learning/tools/verilator-public/). Fidelity is Track A + [../learn_verilator_iverilog](../learn_verilator_iverilog/). Optional shared literacy: [waveform-lab](https://universal-verification-methodology.github.io/learning/tools/waveform-lab/) · [tb-anatomy](https://universal-verification-methodology.github.io/learning/tools/tb-anatomy/).

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see [`LICENSE`](LICENSE).

Path split from [`learn_verilator_iverilog`](https://github.com/universal-verification-methodology/learn_verilator_iverilog). Platform tools and the parent monorepo may carry additional notices.
