# learn_verilog

[![GitHub](https://img.shields.io/badge/GitHub-learn__verilog-181717?logo=github)](https://github.com/universal-verification-methodology/learn_verilog)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](LICENSE)
[![Role](https://img.shields.io/badge/role-Git%20submodule-orange)](https://github.com/universal-verification-methodology/learning)
[![Parent](https://img.shields.io/badge/parent-learning%20monorepo-0A9EDC)](https://github.com/universal-verification-methodology/learning)
[![Labs](https://img.shields.io/badge/labs-GitHub%20Pages-222?logo=githubpages)](https://universal-verification-methodology.github.io/learning/tools/)
[![Domain](https://img.shields.io/badge/domain-Verilog%20%7C%20IEEE%201364%20%7C%20RTL-purple)](https://github.com/universal-verification-methodology/learn_verilog)

**learn_verilog** is the open learning path for *RTL coding in the IEEE 1364 family*.

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
learn_verilog/
├── README.md
├── LICENSE
├── docs/
│   ├── MODULES.md       # full module index (00–19)
│   └── TWO_TRACKS.md
├── scripts/
│   └── module.sh
├── module00-intro/
├── module01-module-diagram/
│   ├── README.md · CHECKLIST.md · EXAMPLES.md
│   ├── outline.yaml · transcript.md
│   └── (optional) slides / video / assets/
├── …
└── module19-wrap/
```

Videos and decks are optional per module. Generate with the **module-slides** skill in the parent monorepo when ready.

## Browse or clone

- **Browser labs:** [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/)
- **Syllabus (parent):** [`syllabus.md` § learn_verilog](https://github.com/universal-verification-methodology/learning/blob/main/syllabus.md#4-learn_verilog)
- **Clone this repo alone:**

```bash
git clone https://github.com/universal-verification-methodology/learn_verilog.git
cd learn_verilog
chmod +x scripts/*.sh
./scripts/module.sh 01 --check
```

Then open [module00-intro/README.md](module00-intro/README.md).

## Consume from the parent

```bash
git clone --recurse-submodules \
  git@github.com:universal-verification-methodology/learning.git
ls courses/learn_verilog
```

## Author: publish or update

```bash
cd courses/learn_verilog
# … edit module README / CHECKLIST / EXAMPLES / transcript …
cd ../..
python .cursor/skills/module-slides/scripts/transcript_to_outline.py \
  courses/learn_verilog/moduleNN-slug
bash .cursor/skills/module-slides/scripts/narrate_clips.sh \
  courses/learn_verilog/moduleNN-slug
```

## Two learning tracks

Every **lab** module documents both tracks. Intro/wrap/bridge extras differ. Details: [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md).

| Track | Practice surface | Start here |
|-------|------------------|------------|
| **A — Real Verilog** | `.v` sketches + optional iverilog / HDL Simulator | [docs/TWO_TRACKS.md](docs/TWO_TRACKS.md) |
| **B — Browser lab** | Platform tools | [local](http://127.0.0.1:8080/tools/) · [live](https://universal-verification-methodology.github.io/learning/tools/) |

Lab status snapshot: **17 shipped** · **0 planned** (see [docs/MODULES.md](docs/MODULES.md)).

## Module landings

Full status table: **[docs/MODULES.md](docs/MODULES.md)**. Clusters: 00 intro · 01–05 structure/ops · 06–08 combo hygiene · 09–13 params/generate · 14–15 patterns · 16–17 lint/style · 18 bridge · 19 wrap.

| Module | Landing |
|--------|---------|
| 00 — Welcome to Verilog RTL | [module00-intro](module00-intro/README.md) |
| 01 — Module / port diagram | [module01-module-diagram](module01-module-diagram/README.md) |
| 02 — Verilog literals | [module02-verilog-literals](module02-verilog-literals/README.md) |
| 03 — wire vs reg | [module03-wire-vs-reg](module03-wire-vs-reg/README.md) |
| 04 — ANSI vs non-ANSI ports | [module04-ansi-ports](module04-ansi-ports/README.md) |
| 05 — Operators | [module05-sv-operators](module05-sv-operators/README.md) |
| 06 — Sensitivity lists | [module06-sensitivity-list](module06-sensitivity-list/README.md) |
| 07 — Latch risk | [module07-latch-risk](module07-latch-risk/README.md) |
| 08 — Blocking vs non-blocking | [module08-blocking-vs-nonblocking](module08-blocking-vs-nonblocking/README.md) |
| 09 — Parameter / width | [module09-param-width](module09-param-width/README.md) |
| 10 — Named vs positional | [module10-named-vs-positional](module10-named-vs-positional/README.md) |
| 11 — localparam | [module11-localparam-lab](module11-localparam-lab/README.md) |
| 12 — Generate / replication | [module12-sv-generate](module12-sv-generate/README.md) |
| 13 — One-driver nets | [module13-one-driver](module13-one-driver/README.md) |
| 14 — Counter patterns | [module14-counter-lab](module14-counter-lab/README.md) |
| 15 — Shift-register patterns | [module15-shift-register-lab](module15-shift-register-lab/README.md) |
| 16 — Synthesizability lint | [module16-synth-lint](module16-synth-lint/README.md) |
| 17 — HDL style | [module17-hdl-style](module17-hdl-style/README.md) |
| 18 — FSM & datapath in RTL | [module18-fsm-datapath-bridge](module18-fsm-datapath-bridge/README.md) |
| 19 — Verilog complete → SV or simulators | [module19-wrap](module19-wrap/README.md) |

## Browser labs

All primary labs for this course are **shipped**: [module-diagram](https://universal-verification-methodology.github.io/learning/tools/module-diagram/) → [verilog-literals](https://universal-verification-methodology.github.io/learning/tools/verilog-literals/) → [wire-vs-reg](https://universal-verification-methodology.github.io/learning/tools/wire-vs-reg/) → [ansi-ports](https://universal-verification-methodology.github.io/learning/tools/ansi-ports/) → [sv-operators](https://universal-verification-methodology.github.io/learning/tools/sv-operators/) → [sensitivity-list](https://universal-verification-methodology.github.io/learning/tools/sensitivity-list/) → [latch-risk](https://universal-verification-methodology.github.io/learning/tools/latch-risk/) → [blocking-vs-nonblocking](https://universal-verification-methodology.github.io/learning/tools/blocking-vs-nonblocking/) → [param-width](https://universal-verification-methodology.github.io/learning/tools/param-width/) → [named-vs-positional](https://universal-verification-methodology.github.io/learning/tools/named-vs-positional/) → [localparam-lab](https://universal-verification-methodology.github.io/learning/tools/localparam-lab/) → [sv-generate](https://universal-verification-methodology.github.io/learning/tools/sv-generate/) → [one-driver](https://universal-verification-methodology.github.io/learning/tools/one-driver/) → [counter-lab](https://universal-verification-methodology.github.io/learning/tools/counter-lab/) → [shift-register-lab](https://universal-verification-methodology.github.io/learning/tools/shift-register-lab/) → [synth-lint](https://universal-verification-methodology.github.io/learning/tools/synth-lint/) → [hdl-style](https://universal-verification-methodology.github.io/learning/tools/hdl-style/). Module 18 reuses digital labs as coding practice.

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see [`LICENSE`](LICENSE).

Path split from [`learn_digital_verilog`](https://github.com/universal-verification-methodology/learn_digital_verilog) and [`learn_verilog_systemverilog`](https://github.com/universal-verification-methodology/learn_verilog_systemverilog). Platform tools and the parent monorepo may carry additional notices.
