#!/usr/bin/env bash
# Register pass-3 course folders as proper git submodules in the learning monorepo.
#
# Prerequisites:
#   - git on PATH
#   - run from monorepo root
#   - public repos already exist on GitHub for each course you register
#   - for nested clones (courses/<name>/.git directory): absorb into submodule
#   - for plain folders (no .git): push content to a new empty public repo first, then re-run
#
# Usage:
#   bash scripts/register_pass3_course_submodules.sh           # existing public remotes only
#   bash scripts/register_pass3_course_submodules.sh --all-ready  # also try missing list if repos exist
#   bash scripts/register_pass3_course_submodules.sh learn_unix learn_git
set -euo pipefail

ORG="${ORG:-universal-verification-methodology}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

READY=(
  learn_unix
  learn_git
  learn_digital
  learn_systemverilog
  learn_uvm2017
  learn_verilator
  learn_hdl_simulator
  learn_uart
  learn_spi
  learn_i2c
  learn_verification_planning_management
)

# Public GitHub missing as of audit — create these first, then register.
MISSING=(
  learn_verilog
  learn_iverilog
  learn_pyuvm
  learn_python_hw
  learn_sv_tb
  learn_cocotb
  learn_formal
)

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not on PATH" >&2
  exit 1
fi

repo_url() {
  echo "git@github.com:${ORG}/$1.git"
}

github_exists() {
  local name="$1"
  if command -v gh >/dev/null 2>&1; then
    gh repo view "${ORG}/${name}" >/dev/null 2>&1
    return $?
  fi
  # fallback: ls-remote (needs network + auth for private; public works anonymously over https)
  git ls-remote --heads "https://github.com/${ORG}/${name}.git" HEAD >/dev/null 2>&1
}

ensure_gitmodules_entry() {
  local name="$1"
  local path="courses/${name}"
  local url
  url="$(repo_url "$name")"
  if git config -f .gitmodules --get "submodule.${path}.url" >/dev/null 2>&1; then
    git config -f .gitmodules "submodule.${path}.path" "$path"
    git config -f .gitmodules "submodule.${path}.url" "$url"
    git config -f .gitmodules "submodule.${path}.branch" main
  else
    git config -f .gitmodules --add "submodule.${path}.path" "$path"
    git config -f .gitmodules "submodule.${path}.url" "$url"
    git config -f .gitmodules "submodule.${path}.branch" main
  fi
  # sync into .git/config
  git submodule sync -- "$path" 2>/dev/null || true
}

register_one() {
  local name="$1"
  local path="courses/${name}"
  local url
  url="$(repo_url "$name")"

  echo ""
  echo "=== ${name} ==="

  if [[ ! -d "$path" ]]; then
    echo "SKIP: missing directory $path"
    return 0
  fi

  if ! github_exists "$name"; then
    echo "SKIP: no public GitHub repo ${ORG}/${name}"
    echo "      Create it first, e.g.:"
    echo "        gh repo create ${ORG}/${name} --public --source=$path --remote=origin --push"
    return 0
  fi

  ensure_gitmodules_entry "$name"

  if [[ -f "$path/.git" ]]; then
    echo "Already a submodule gitfile — absorb/sync"
    git submodule absorbgitdirs -- "$path" 2>/dev/null || true
    git add "$path" .gitmodules
    echo "OK: $path"
    return 0
  fi

  if [[ -d "$path/.git" ]]; then
    echo "Converting nested gitdir → submodule (absorbgitdirs)"
    # De-index any previously tracked normal files for this path
    git rm -r --cached --ignore-unmatch "$path" >/dev/null 2>&1 || true
    ensure_gitmodules_entry "$name"
    # Record as gitlink at current HEAD of the nested repo
    local sha
    sha="$(git -C "$path" rev-parse HEAD)"
    git submodule absorbgitdirs -- "$path"
    # Force gitlink mode
    git update-index --add --cacheinfo 160000,"$sha","$path"
    git add .gitmodules
    echo "OK: $path @ $sha"
    return 0
  fi

  # Plain folder: content lives only in monorepo — publish then re-link
  echo "Plain folder (no .git). Publish then convert:"
  echo "  cd $path && git init -b main && git add -A && git commit -m 'chore: initial course tree'"
  echo "  gh repo create ${ORG}/${name} --public --source=. --remote=origin --push"
  echo "  cd $ROOT && bash scripts/register_pass3_course_submodules.sh ${name}"
}

NAMES=()
ALL_READY=0
for arg in "$@"; do
  case "$arg" in
    --all-ready) ALL_READY=1 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *) NAMES+=("$arg") ;;
  esac
done

if [[ ${#NAMES[@]} -eq 0 ]]; then
  NAMES=("${READY[@]}")
  if [[ "$ALL_READY" -eq 1 ]]; then
    NAMES+=("${MISSING[@]}")
  fi
fi

echo "Registering ${#NAMES[@]} course path(s) under $ROOT"
for name in "${NAMES[@]}"; do
  register_one "$name"
done

echo ""
echo "Done. Review with: git submodule status"
echo "Commit when ready: git add .gitmodules courses && git commit -m 'chore: register pass-3 course submodules'"
echo ""
echo "Still need public GitHub repos for:"
for name in "${MISSING[@]}"; do
  if github_exists "$name"; then
    echo "  - ${name} (NOW EXISTS — re-run with: bash scripts/register_pass3_course_submodules.sh ${name})"
  else
    echo "  - ${ORG}/${name}"
  fi
done
