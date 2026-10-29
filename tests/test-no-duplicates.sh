#!/bin/bash
# Mac di sviluppo: nessun doppione delle fse-* in ~/.claude, hook fse non registrati due volte, plugin installato.
# Sul Mac di uno studente (nessuna ~/.claude/skills con famiglia starter) le asserzioni sono neutre.
set -euo pipefail
name="test-no-duplicates"
fail() { echo "FAIL $name: $1"; exit 1; }
C="$HOME/.claude"

if [ -d "$C/skills" ]; then
  for s in fse-theme-setup fse-brief fse-kit fse-build fse-block-edit fse-menu-build; do
    [ ! -e "$C/skills/$s" ] || fail "doppione: $C/skills/$s esiste ancora"
  done
  [ ! -e "$C/skills/_shared/fse-foundations.md" ] || fail "doppione: _shared/fse-foundations.md"
  [ ! -e "$C/skills/_shared/scripts/sync-theme-json-tokens.js" ] || fail "doppione: _shared/scripts/sync-theme-json-tokens.js"
fi
[ ! -e "$C/hooks/check-block-contract.sh" ] || fail "doppione: hooks/check-block-contract.sh"
if [ -f "$C/settings.json" ]; then
  ! grep -q 'check-block-contract.sh' "$C/settings.json" || fail "settings.json registra ancora check-block-contract.sh"
fi
if [ -f "$C/hooks/check-design-tokens.sh" ]; then
  ! grep -q 'theme\.json' "$C/hooks/check-design-tokens.sh" || fail "l'hook globale check-design-tokens.sh ha ancora il ramo theme.json"
fi
claude plugin list 2>/dev/null | grep -q 'wdm-agent' || fail "claude plugin list non elenca wdm-agent"

echo "PASS $name"
