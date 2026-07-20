#!/usr/bin/env bash
# Capture a lab UI snapshot for module-slides (wraps capture_lab_snapshot.py).
# Prefer WSL/Linux when Chromium deps are installed there.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/capture_lab_snapshot.py" "$@"
