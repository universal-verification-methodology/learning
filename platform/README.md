# Unix & Git Lab Platform

[![Website](https://img.shields.io/badge/website-github.io%2Flearning-0f6b5c)](https://universal-verification-methodology.github.io/learning/)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-green?logo=creativecommons&logoColor=white)](sandbox/unix-git-practice/LICENSE)
[![Type](https://img.shields.io/badge/type-browser%20labs-blue)](tools/index.html)
[![Course](https://img.shields.io/badge/course-learn__unix__git-0A9EDC)](https://github.com/universal-verification-methodology/learn_unix_git)
[![Sandbox](https://img.shields.io/badge/sandbox-unix--git--practice-orange)](https://github.com/universal-verification-methodology/unix-git-practice)

**Live site:** [https://universal-verification-methodology.github.io/learning/](https://universal-verification-methodology.github.io/learning/)

Static companion site for [`learn_unix_git`](https://github.com/universal-verification-methodology/learn_unix_git): **client-side** interactive tools (no server, no install) plus links to the real GitHub practice sandbox for remotes, PRs, Make, and submodules.

Browser labs teach the hard-to-visualize ideas (filesystem tree, pipes, Git DAG, conflicts). Real push/PR/submodule work happens on [`unix-git-practice`](https://github.com/universal-verification-methodology/unix-git-practice).

## Table of contents

- [Live site](#live-site)
- [Quick start](#quick-start)
- [Tool map](#tool-map)
- [GitHub sandbox](#github-sandbox)
- [How this splits with the course](#how-this-splits-with-the-course)
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

## Tool map

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

## GitHub sandbox

| Local tree | GitHub |
|------------|--------|
| [`sandbox/unix-git-practice/`](sandbox/unix-git-practice/) | [unix-git-practice](https://github.com/universal-verification-methodology/unix-git-practice) (**template**) |
| [`sandbox/unix-git-shared-ip/`](sandbox/unix-git-shared-ip/) | [unix-git-shared-ip](https://github.com/universal-verification-methodology/unix-git-shared-ip) (submodule) |

Config for the remotes lab: [`tools/remotes/config.js`](tools/remotes/config.js)  
Publish / About blurbs: [`sandbox/PUBLISH.md`](sandbox/PUBLISH.md), [`sandbox/GITHUB_ABOUT.md`](sandbox/GITHUB_ABOUT.md)  
Course index: [`courses/learn_unix_git/SANDBOX.md`](../courses/learn_unix_git/SANDBOX.md)

## How this splits with the course

| Layer | Owns |
|-------|------|
| **learn_unix_git** | Module docs, local `examples/`, `moduleN.sh` checks |
| **platform/tools** | In-browser simulators (subset of shell/Git semantics) |
| **unix-git-practice** | Real remote, PR, Make, submodule rehearsal |

## Layout

```text
platform/
├── index.html
├── assets/
├── tools/
│   ├── index.html
│   ├── remotes/
│   └── …
└── sandbox/
    ├── unix-git-practice/
    ├── unix-git-shared-ip/
    ├── PUBLISH.md
    └── GITHUB_ABOUT.md
```

## License

Sandbox templates and course materials use [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see each repo’s `LICENSE`).
