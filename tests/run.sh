#!/bin/bash
# Esegue ogni tests/test-*.sh e riassume. Exit 0 solo se tutti passano.
set -uo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
failed=()

for t in "$PLUGIN_ROOT"/tests/test-*.sh; do
  name="$(basename "$t" .sh)"
  if ! bash "$t"; then
    failed+=("$name")
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "FAILED: ${failed[*]}"
  exit 1
fi
echo "ALL GREEN"
