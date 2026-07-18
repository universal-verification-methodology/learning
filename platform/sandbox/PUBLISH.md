# Publishing sandbox repos to GitHub

Org: [universal-verification-methodology](https://github.com/universal-verification-methodology)

## Current course: Unix & Git

| Local folder | GitHub repo | Status |
|--------------|-------------|--------|
| `unix-git-practice/` | [unix-git-practice](https://github.com/universal-verification-methodology/unix-git-practice) | Template + content; push LICENSE / Makefile bash fixes if pending |
| `unix-git-shared-ip/` | [unix-git-shared-ip](https://github.com/universal-verification-methodology/unix-git-shared-ip) | Content + submodule wired; push LICENSE if pending |

### Push leftover local updates (LICENSE, bash Makefile, docs)

```bash
cd platform/sandbox/unix-git-practice
git add -A
git commit -m "Add LICENSE; run scripts via bash; docs"
git push

cd ../unix-git-shared-ip
git add -A
git commit -m "Add CC BY 4.0 LICENSE"
git push
```

Paste **About** text from [GITHUB_ABOUT.md](GITHUB_ABOUT.md) into each repo’s Settings → General → Description / Topics.


Platform URLs: `platform/tools/remotes/config.js`

### Push the practice template

From a machine with Git + SSH (or HTTPS) access:

```bash
cd platform/sandbox/unix-git-practice
git init -b main
git add .
git commit -m "Initial practice lab template"
git remote add origin git@github.com:universal-verification-methodology/unix-git-practice.git
# if remote already added:
# git remote set-url origin git@github.com:universal-verification-methodology/unix-git-practice.git
git push -u origin main
```

Mark the GitHub repo as a **Template repository** (Settings → Template repository) so students can “Use this template” / Classroom can fork cleanly.

### Push shared-ip, then wire submodule

```bash
cd platform/sandbox/unix-git-shared-ip
git init -b main
git add .
git commit -m "Initial shared-ip stub"
git remote add origin git@github.com:universal-verification-methodology/unix-git-shared-ip.git
git push -u origin main

cd ../unix-git-practice
# if external/README.md conflicts with submodule path, remove it first:
git rm -f external/README.md 2>/dev/null || rm -f external/README.md
git submodule add https://github.com/universal-verification-methodology/unix-git-shared-ip.git external/shared-ip
git commit -m "Add shared-ip submodule"
git push
```
## Later courses

Prefer one sandbox repo per course, same org, e.g. `sandbox-digital-verilog` or `digital-verilog-practice`. Keep libs as `*-shared-*` / `sandbox-lib-*` repos.
