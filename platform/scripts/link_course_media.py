#!/usr/bin/env python3
"""Link courses/<repo> into platform/course-media/<repo> for local lab-page media.

Uses **relative** symlink targets (../../courses/<repo>) so links work on any
machine after clone. Lab pages can load video/slides/quiz from /course-media/
when mediaSource is \"local\" or \"auto\". Production Pages uses CDN.

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


def relative_target(repo: str) -> str:
    """Target string stored in the symlink (relative to platform/course-media/)."""
    return os.path.join("..", "..", "courses", repo)


def link_one(repo: str, *, force: bool = False) -> bool:
    src = COURSES / repo
    dst = MEDIA / repo
    rel = relative_target(repo)
    if not src.is_dir():
        print(f"SKIP {repo}: missing {src}", file=sys.stderr)
        return False
    MEDIA.mkdir(parents=True, exist_ok=True)

    if dst.is_symlink() or dst.exists():
        same_resolved = False
        try:
            same_resolved = dst.resolve() == src.resolve()
        except OSError:
            same_resolved = False
        current = os.readlink(dst) if dst.is_symlink() else None
        # Normalize separators for comparison
        current_norm = current.replace("\\", "/") if current else None
        rel_norm = rel.replace("\\", "/")
        if (
            not force
            and same_resolved
            and current_norm == rel_norm
        ):
            print(f"OK   {repo}: already linked ({rel_norm})")
            return True
        if dst.is_symlink():
            dst.unlink()
        elif dst.is_dir():
            if any(dst.iterdir()):
                print(f"FAIL {repo}: {dst} exists and is not empty", file=sys.stderr)
                return False
            dst.rmdir()
        else:
            print(f"FAIL {repo}: {dst} exists and is not a link/dir", file=sys.stderr)
            return False

    try:
        # Relative target so the link is portable across machines/checkouts.
        os.symlink(rel, dst, target_is_directory=True)
        print(f"OK   {repo}: symlink -> {rel}")
        return True
    except OSError:
        # Windows without symlink privilege: directory junction (absolute only).
        if os.name == "nt":
            import subprocess

            r = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(dst), str(src)],
                capture_output=True,
                text=True,
            )
            if r.returncode == 0:
                print(
                    f"OK   {repo}: junction -> {src} "
                    f"(absolute; prefer Developer Mode for relative symlinks)",
                    file=sys.stderr,
                )
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
    ap.add_argument(
        "--force",
        action="store_true",
        help="Recreate links even if they already resolve correctly",
    )
    args = ap.parse_args()
    repos = args.repos
    if not repos:
        repos = sorted(p.name for p in COURSES.glob("learn_*") if p.is_dir())
    ok = 0
    for repo in repos:
        if link_one(repo, force=args.force):
            ok += 1
    print(f"Linked {ok}/{len(repos)} -> {MEDIA}")
    return 0 if ok == len(repos) else 1


if __name__ == "__main__":
    raise SystemExit(main())
