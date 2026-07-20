#!/usr/bin/env bash
# Track A demo for module04-ansi-ports (session frame for slides).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EX="$MOD_DIR/examples/ansi_ports/and2_styles.v"

echo '# real Verilog session (Track A)'
echo

printf '%s\n' '$ cat examples/ansi_ports/and2_styles.v'
cat "$EX"
echo

if command -v iverilog >/dev/null 2>&1; then
  printf '%s\n' '$ iverilog -t null examples/ansi_ports/and2_styles.v'
  iverilog -t null "$EX"
  echo '(syntax check passed)'
else
  echo '# iverilog not on PATH — editor-only sketch is still valid Track A practice'
fi
echo
