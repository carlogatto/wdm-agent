#!/bin/bash
# Nessun percorso del Mac di Carlo o di ~/.claude dentro il plugin (tests/, docs/ e README esclusi: raccontano la migrazione).
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-no-absolute-paths"

[ -d "$PLUGIN_ROOT/skills" ] || { echo "FAIL $name: cartella skills/ assente"; exit 1; }

hits="$(grep -rnE '~/\.claude|\$HOME/\.claude|/Users/macbookpro16m1' "$PLUGIN_ROOT" \
  --exclude-dir=tests --exclude-dir=docs --exclude-dir=.git --exclude=README.md || true)"
if [ -n "$hits" ]; then
  echo "FAIL $name: percorsi assoluti trovati:"
  echo "$hits"
  exit 1
fi
echo "PASS $name"
