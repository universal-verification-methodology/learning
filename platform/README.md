# Digital Design and Verification Platform

[![Website](https://img.shields.io/badge/website-github.io%2Flearning-0f6b5c)](https://universal-verification-methodology.github.io/learning/)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](sandbox/unix-git-practice/LICENSE)
[![Type](https://img.shields.io/badge/type-browser%20labs-blue)](tools/index.html)
[![Catalog](https://img.shields.io/badge/catalog-tools.md-0A9EDC)](tools.md)

**Live site:** [https://universal-verification-methodology.github.io/learning/](https://universal-verification-methodology.github.io/learning/)

Static companion site for the learning monorepo: **client-side** interactive tools (no server, no install), organized by **concept domain** — not by course or module. Courses link to tools when useful; real simulators and remotes stay in course repos / sandboxes.

## Table of contents

- [Live site](#live-site)
- [Quick start](#quick-start)
- [Tool map (shipped)](#tool-map-shipped)
- [Full tools catalog](#full-tools-catalog)
- [GitHub sandbox](#github-sandbox)
- [How this splits with courses](#how-this-splits-with-courses)
- [Layout](#layout)
- [License](#license)

## Live site

Open **[https://universal-verification-methodology.github.io/learning/](https://universal-verification-methodology.github.io/learning/)** (GitHub Pages). Tools: [https://universal-verification-methodology.github.io/learning/tools/](https://universal-verification-methodology.github.io/learning/tools/).

## Quick start

```bash
# from the learning monorepo root
python -m http.server 8080 --directory platform
```

Open http://localhost:8080/ → **Tools**.

Opening `file://` HTML also works after a hard refresh when scripts change.

## Tool map (shipped)

| Tool | Path | Skills |
|------|------|--------|
| Virtual filesystem terminal | [`tools/vfs-terminal/`](tools/vfs-terminal/) | nav, globs, less, man, symlinks |
| Permissions, umask, PATH & ownership | [`tools/permissions/`](tools/permissions/) | modes, umask, PATH, owner/group, export |
| Pipes, redirection, xargs & jobs | [`tools/pipes/`](tools/pipes/) | pipes, redirects, tee, xargs, jobs |
| Script exit codes & control flow | [`tools/scripting/`](tools/scripting/) | if/for/case, alias, functions, read, set -e |
| Project layout, archives, sed & diff | [`tools/project-archives/`](tools/project-archives/) | tree, find/grep, tar, sed, diff |
| Git graph, staging, stash & rebase | [`tools/git-graph/`](tools/git-graph/) | status, merge/rebase, cherry-pick, stash, tags, reflog |
| Merge conflict resolver | [`tools/git-conflicts/`](tools/git-conflicts/) | conflict markers |
| Blame & bisect | [`tools/blame-bisect/`](tools/blame-bisect/) | blame, bisect |
| Remotes, PRs & submodules | [`tools/remotes/`](tools/remotes/) | checklist against the live sandbox |
| Pre-push checklist, Make & env | [`tools/workflow/`](tools/workflow/) | check_ready, make, env, dry-run clean |
| Truth-table builder | [`tools/truth-table/`](tools/truth-table/) | HDL `createCombEvaluator` |
| Gate composer | [`tools/gate-composer/`](tools/gate-composer/) | HDL `createGateNetEvaluator` |
| Verilog literals | [`tools/verilog-literals/`](tools/verilog-literals/) | HDL `parseLiteral` |
| Radix converter | [`tools/radix-converter/`](tools/radix-converter/) | HDL `Value` / `parseLiteral` |
| Clock-edge stepper | [`tools/clock-stepper/`](tools/clock-stepper/) | HDL `createSession` · Step / ↗posedge |

## Full tools catalog

Shipped **and** planned labs by concept domain: **[`tools.md`](tools.md)**. Browseable list (with “Coming soon”): [`tools/index.html`](tools/index.html).

HDL engine integration: **[`simulator.md`](simulator.md)** — public [`systemverilog-simulator`](https://github.com/universal-verification-methodology/systemverilog-simulator) `engine.mjs` (vendored under `vendor/`).

## GitHub sandbox

| Local tree | GitHub |
|------------|--------|
| [`sandbox/unix-git-practice/`](sandbox/unix-git-practice/) | [unix-git-practice](https://github.com/universal-verification-methodology/unix-git-practice) (**template**) |
| [`sandbox/unix-git-shared-ip/`](sandbox/unix-git-shared-ip/) | [unix-git-shared-ip](https://github.com/universal-verification-methodology/unix-git-shared-ip) (submodule) |

Config for the remotes lab: [`tools/remotes/config.js`](tools/remotes/config.js)  
Publish / About blurbs: [`sandbox/PUBLISH.md`](sandbox/PUBLISH.md), [`sandbox/GITHUB_ABOUT.md`](sandbox/GITHUB_ABOUT.md)  
Course index: [`courses/learn_unix_git/SANDBOX.md`](../courses/learn_unix_git/SANDBOX.md)

## How this splits with courses

| Layer | Owns |
|-------|------|
| **Course repos** (`courses/*`) | Module docs, examples, real toolchains (shell, iverilog, Verilator, UVM, …) |
| **platform/tools** | In-browser concept labs (subset semantics) |
| **Sandboxes** (e.g. unix-git-practice) | Real remotes, PRs, Make rehearsal |

## Layout

```text
platform/
├── index.html
├── tools.md          # canonical shipped + planned catalog
├── simulator.md      # HDL engine integration (public systemverilog-simulator)
├── vendor/           # pinned engine.mjs (refresh from public release)
├── assets/
├── tools/
│   ├── index.html    # browsable domain list
│   └── …
└── sandbox/
    ├── unix-git-practice/
    ├── unix-git-shared-ip/
    ├── PUBLISH.md
    └── GITHUB_ABOUT.md
```

## License

Sandbox templates and course materials use [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see each repo’s `LICENSE`).
