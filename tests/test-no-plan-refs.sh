#!/bin/bash
# Skill e fondamenta non citano piani, fasi di piano o decisioni numerate: descrivono il sistema com'è.
# Le "Phase 1–5" di fse-theme-setup sono le sue fasi di esecuzione e non rientrano nel pattern.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-no-plan-refs"

pattern='decision [0-9]+ of the plan|Phase [0-9]+ M[0-9]+|\bTask [0-9]+\b|docs/superpowers/plans|dry run Phase'
hits="$(grep -rnE "$pattern" "$PLUGIN_ROOT/skills" "$PLUGIN_ROOT/shared/fse-foundations.md" || true)"
if [ -n "$hits" ]; then
  echo "FAIL $name: riferimenti a piani/fasi:"
  echo "$hits"
  exit 1
fi
echo "PASS $name"
