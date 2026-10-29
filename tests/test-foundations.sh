#!/bin/bash
# Le convenzioni "prodotto" (spec wdm-theme 2026-10-26) sono scritte nelle fondamenta; versione 1.2.0.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-foundations"
fail() { echo "FAIL $name: $1"; exit 1; }
F="$PLUGIN_ROOT/shared/fse-foundations.md"
for s in '_section.scss' 'Shared attribute vocabulary' 'headingLevel' 'token-exception' '_focus.scss' '_motion.scss' '{prefix}-swiper' '--wp--custom--shadow--' 'keywords' 'in_array(' 'aria-expanded' 'reverse'; do
  grep -qF -- "$s" "$F" || fail "manca '$s' nelle fondamenta"
done
v1="$(jq -r .version "$PLUGIN_ROOT/.claude-plugin/plugin.json")"
v2="$(jq -r '.plugins[0].version' "$PLUGIN_ROOT/.claude-plugin/marketplace.json")"
[ "$v1" = "1.2.0" ] && [ "$v2" = "1.2.0" ] || fail "versione plugin.json=$v1 marketplace.json=$v2, attesa 1.2.0"
echo "PASS $name"
