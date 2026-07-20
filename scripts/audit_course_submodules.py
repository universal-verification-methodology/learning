#!/usr/bin/env python3
"""Audit course folders vs public GitHub org repos vs .gitmodules."""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ORG = "universal-verification-methodology"
ROOT = Path(__file__).resolve().parents[1]
COURSES = ROOT / "courses"

# Pass-3 target courses (should be public submodules)
TARGETS = [
    "learn_unix",
    "learn_git",
    "learn_digital",
    "learn_verilog",
    "learn_systemverilog",
    "learn_uvm2017",
    "learn_verilator",
    "learn_iverilog",
    "learn_hdl_simulator",
    "learn_pyuvm",
    "learn_uart",
    "learn_spi",
    "learn_i2c",
    "learn_verification_planning_management",
    "learn_python_hw",
    "learn_sv_tb",
    "learn_cocotb",
    "learn_formal",
]

LEGACY = [
    "learn_unix_git",
    "learn_digital_verilog",
    "learn_verilog_systemverilog",
    "learn_verilator_iverilog",
    "learn_uart_spi_i2c",
    "learn_uvm_pyuvm",
    "verification_planning_management",
    "learn_uvm2017_sv_verilator",
]


def fetch_org_repos() -> dict[str, dict]:
    found: dict[str, dict] = {}
    for page in range(1, 6):
        url = f"https://api.github.com/orgs/{ORG}/repos?per_page=100&page={page}&type=all"
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "learning-audit"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        if not data:
            break
        for repo in data:
            found[repo["name"]] = {
                "private": bool(repo["private"]),
                "html": repo["html_url"],
                "archived": bool(repo.get("archived")),
                "default_branch": repo.get("default_branch"),
            }
    return found


def parse_gitmodules() -> dict[str, str]:
    gm = ROOT / ".gitmodules"
    if not gm.is_file():
        return {}
    out: dict[str, str] = {}
    path = url = None
    for line in gm.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s.startswith("path ="):
            path = s.split("=", 1)[1].strip()
        elif s.startswith("url ="):
            url = s.split("=", 1)[1].strip()
            if path:
                out[path] = url
                path = url = None
    return out


def local_kind(name: str) -> str:
    d = COURSES / name
    if not d.is_dir():
        return "missing-dir"
    git = d / ".git"
    if git.is_file():
        return "submodule-gitfile"
    if git.is_dir():
        # read remote if possible
        cfg = git / "config"
        remote = ""
        if cfg.is_file():
            text = cfg.read_text(encoding="utf-8", errors="ignore")
            for line in text.splitlines():
                if "url =" in line:
                    remote = line.split("=", 1)[1].strip()
                    break
        return f"nested-gitdir remote={remote or '?'}"
    return "plain-folder"


def main() -> None:
    repos = fetch_org_repos()
    gm = parse_gitmodules()
    print(f"Org public/all repos fetched: {len(repos)}")
    print(f".gitmodules entries: {len(gm)}")
    print()

    print("=== TARGET COURSES (pass 3) ===")
    missing_gh = []
    need_submodule = []
    for name in TARGETS:
        remote = repos.get(name)
        kind = local_kind(name)
        in_gm = f"courses/{name}" in gm
        if remote is None:
            status = "NO_GITHUB_REPO"
            missing_gh.append(name)
        elif remote["private"]:
            status = "GITHUB_PRIVATE"
            missing_gh.append(name)
        else:
            status = "github-public"
        if not in_gm:
            need_submodule.append(name)
        print(f"{name:45} {status:18} local={kind:40} gitmodules={in_gm}")
        if remote:
            print(f"{'':45} {remote['html']}")

    print()
    print("=== LEGACY (already in .gitmodules typically) ===")
    for name in LEGACY:
        remote = repos.get(name)
        kind = local_kind(name)
        in_gm = f"courses/{name}" in gm
        st = "github-public" if remote and not remote["private"] else ("NO_GITHUB" if not remote else "PRIVATE")
        print(f"{name:45} {st:18} local={kind:40} gitmodules={in_gm}")

    print()
    print("=== MISSING PUBLIC GITHUB (create these) ===")
    for n in missing_gh:
        print(f"  - https://github.com/{ORG}/{n}  (does not exist or not public)")

    print()
    print("=== TARGETS NOT IN .gitmodules (should become submodules) ===")
    for n in need_submodule:
        print(f"  - courses/{n}")

    report = {
        "missing_public_github": missing_gh,
        "targets_not_in_gitmodules": need_submodule,
        "org_repo_count": len(repos),
    }
    out = ROOT / "scripts" / "_course_submodule_audit.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print()
    print("Wrote", out)


if __name__ == "__main__":
    main()
