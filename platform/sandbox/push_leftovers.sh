#!/usr/bin/env bash
# Push leftover sandbox updates (run from a machine with git + SSH/HTTPS auth).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

push_repo() {
  local dir="$1"
  local msg="$2"
  cd "$dir"
  git add -A
  if git diff --cached --quiet; then
    echo "OK  $dir — nothing to commit"
  else
    git commit -m "$msg"
    git push
    echo "OK  $dir — pushed"
  fi
}

push_repo "$ROOT/unix-git-practice" "Add CC BY 4.0 LICENSE; invoke scripts via bash; upgrade README"
push_repo "$ROOT/unix-git-shared-ip" "Add CC BY 4.0 LICENSE; upgrade README"

echo
echo "Also paste Descriptions/Topics from GITHUB_ABOUT.md into GitHub Settings → General."
echo "Course links: commit/push courses/learn_unix_git (SANDBOX.md + module README links)."
