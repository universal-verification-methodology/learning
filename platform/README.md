# Unix & Git Lab Platform

Static companion site for [`courses/learn_unix_git`](../courses/learn_unix_git): client-side interactive tools (no server, no install).

## Open locally

Serve the `platform` folder with any static server, or open files directly:

```bash
# from repo root (Python)
python -m http.server 8080 --directory platform
```

Then visit `http://localhost:8080/` → **Tools**.

## Tools

| Tool | Path | Course |
|------|------|--------|
| Virtual filesystem terminal | `tools/vfs-terminal/` | Module 1 |
| Permissions & umask | `tools/permissions/` | Module 2 |
| Pipes & filters | `tools/pipes/` | Module 3 |
| Git commit graph | `tools/git-graph/` | Modules 6–7 |

All logic runs in the browser (in-memory VFS / commit DAG). Labs intentionally implement a **subset** of real shell/Git.

## Layout

```
platform/
├── index.html
├── assets/
│   ├── site.css
│   ├── site.js
│   └── tools-shared.css
└── tools/
    ├── index.html
    ├── vfs-terminal/
    ├── permissions/
    ├── pipes/
    └── git-graph/
```
