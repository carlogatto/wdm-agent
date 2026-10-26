#!/bin/bash
# README: comandi di installazione/aggiornamento/sviluppo, prerequisiti e sezioni obbligatorie.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-readme"
fail() { echo "FAIL $name: $1"; exit 1; }
R="$PLUGIN_ROOT/README.md"
[ -f "$R" ] || fail "manca README.md"

for s in \
  'claude plugin marketplace add carlogatto/wdm-agent' \
  'claude plugin install wdm-agent@wdm-agent' \
  'claude plugin update wdm-agent@wdm-agent' \
  'claude plugin uninstall wdm-agent@wdm-agent' \
  'claude plugin marketplace add ~/Documents/Development/wdm-agent' \
  '/reload-plugins' \
  'brew install jq' \
  'gh auth setup-git' \
  'bash tests/run.sh' \
  'claude plugin list' \
  'claude plugin uninstall wdm-agent@wdm-agent && claude plugin install wdm-agent@wdm-agent'; do
  grep -qF -- "$s" "$R" || fail "manca la stringa: $s"
done

for h in "Cos'è" "Cosa contiene" "Prerequisiti" "Installazione" "Aggiornamento" "Verifica dell'installazione" "Disinstallazione" "Sviluppo" "Come sono scritti i percorsi" "Storia"; do
  grep -qF -- "## $h" "$R" || fail "manca la sezione: ## $h"
done

# ~/.claude compare solo nella sezione Storia (la cache di Claude Code, ~/.claude/plugins/…, è ammessa ovunque)
n_total="$(grep '~/.claude' "$R" | grep -vc '~/.claude/plugins' || true)"
n_storia="$(sed -n '/^## Storia/,$p' "$R" | grep '~/.claude' | grep -vc '~/.claude/plugins' || true)"
[ "$n_total" -eq "$n_storia" ] || fail "~/.claude citato fuori dalla sezione Storia ($n_total vs $n_storia)"

echo "PASS $name"
