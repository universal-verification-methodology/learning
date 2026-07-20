#!/usr/bin/env bash
# Create missing public course repos on GitHub and push local trees.
# Requires: gh auth login, git on PATH
#
# Usage (from monorepo root):
#   bash scripts/create_missing_course_repos.sh
#   bash scripts/create_missing_course_repos.sh learn_verilog learn_formal
set -euo pipefail

ORG="${ORG:-universal-verification-methodology}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MISSING=(
  learn_verilog
  learn_iverilog
  learn_pyuvm
  learn_python_hw
  learn_sv_tb
  learn_cocotb
  learn_formal
)

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh (GitHub CLI) not on PATH. Install from https://cli.github.com/ then: gh auth login" >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not on PATH" >&2
  exit 1
fi

NAMES=("${@:-}")
if [[ ${#NAMES[@]} -eq 0 || -z "${NAMES[0]:-}" ]]; then
  NAMES=("${MISSING[@]}")
fi

for name in "${NAMES[@]}"; do
  path="courses/${name}"
  echo ""
  echo "=== ${name} ==="
  if [[ ! -d "$path" ]]; then
    echo "SKIP: no local folder $path"
    continue
  fi
  if gh repo view "${ORG}/${name}" >/dev/null 2>&1; then
    echo "EXISTS: https://github.com/${ORG}/${name}"
    continue
  fi

  if [[ ! -d "$path/.git" && ! -f "$path/.git" ]]; then
    echo "Initializing git in $path"
    git -C "$path" init -b main
    # minimal ignore for local media build junk if present
    if [[ ! -f "$path/.gitignore" ]]; then
      printf '%s\n' '_pass2_narrate.log' '**/build.log' '**/frames/' >"$path/.gitignore"
    fi
    git -C "$path" add -A
    if git -C "$path" diff --cached --quiet; then
      echo "WARN: nothing to commit in $path"
    else
      git -C "$path" -c user.email="${GIT_AUTHOR_EMAIL:-course-bot@users.noreply.github.com}" \
        -c user.name="${GIT_AUTHOR_NAME:-course-bot}" \
        commit -m "chore: initial ${name} course tree"
    fi
  fi

  echo "Creating public repo ${ORG}/${name} and pushing…"
  gh repo create "${ORG}/${name}" --public --source="$path" --remote=origin --push
  echo "OK: https://github.com/${ORG}/${name}"
done

echo ""
echo "Next: bash scripts/register_pass3_course_submodules.sh --all-ready"
