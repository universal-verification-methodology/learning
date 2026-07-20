#!/usr/bin/env python3
"""Link courses/<repo> into platform/course-media/<repo> for local lab-page media.

Lab pages on localhost load video/slides/quiz from /course-media/<repo>/…
(see assets/site-config.js mediaSource: \"auto\"). Production Pages still uses CDN.

Usage (from monorepo root):
  python platform/scripts/link_course_media.py
  python platform/scripts/link_course_media.py learn_spi
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSES = ROOT / "courses"
MEDIA = ROOT / "platform" / "course-media"


def link_one(repo: str) -> bool:
    src = COURSES / repo
    dst = MEDIA / repo
    if not src.is_dir():
        print(f"SKIP {repo}: missing {src}", file=sys.stderr)
        return False
    MEDIA.mkdir(parents=True, exist_ok=True)
    if dst.is_symlink() or dst.exists():
        if dst.resolve() == src.resolve():
            print(f"OK   {repo}: already linked")
            return True
        if dst.is_symlink() or dst.is_dir():
            # Replace stale link / empty dir
            if dst.is_symlink():
                dst.unlink()
            elif not any(dst.iterdir()):
                dst.rmdir()
            else:
                print(f"FAIL {repo}: {dst} exists and is not empty", file=sys.stderr)
                return False
    try:
        os.symlink(src, dst, target_is_directory=True)
        print(f"OK   {repo}: symlink -> {src}")
        return True
    except OSError:
        # Windows without symlink privilege: directory junction
        if os.name == "nt":
            import subprocess

            r = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(dst), str(src)],
                capture_output=True,
                text=True,
            )
            if r.returncode == 0:
                print(f"OK   {repo}: junction -> {src}")
                return True
            print(f"FAIL {repo}: {r.stderr or r.stdout}", file=sys.stderr)
            return False
        print(f"FAIL {repo}: could not symlink ({sys.exc_info()[1]})", file=sys.stderr)
        return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "repos",
        nargs="*",
        help="Course folder names under courses/ (default: all learn_*)",
    )
    args = ap.parse_args()
    repos = args.repos
    if not repos:
        repos = sorted(p.name for p in COURSES.glob("learn_*") if p.is_dir())
    ok = 0
    for repo in repos:
        if link_one(repo):
            ok += 1
    print(f"Linked {ok}/{len(repos)} -> {MEDIA}")
    return 0 if ok == len(repos) else 1


if __name__ == "__main__":
    raise SystemExit(main())
