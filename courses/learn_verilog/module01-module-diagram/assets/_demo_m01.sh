#!/usr/bin/env bash
# Track A demo for module01-module-diagram (session frame for slides).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EX="$MOD_DIR/examples/and2/and2.v"

echo '# real Verilog session (Track A)'
echo

printf '%s\n' '$ cat examples/and2/and2.v'
cat "$EX"
echo

if command -v iverilog >/dev/null 2>&1; then
  printf '%s\n' '$ iverilog -t null examples/and2/and2.v'
  iverilog -t null "$EX"
  echo '(syntax check passed)'
else
  echo '# iverilog not on PATH — editor-only sketch is still valid Track A practice'
fi
echo
