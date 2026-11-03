#!/bin/bash
# Le convenzioni "prodotto" (spec wdm-theme 2026-10-26) e il flusso a gate (2026-10-30, tre gate dal 2026-11-02) sono scritti nelle fondamenta; versione 1.4.0 (1.3.1: il messaggio di consegna §10; 1.3.2: password dell'utente agente in `.env`; 1.4.0: tre gate, l'ok continua nella stessa conversazione, blocchi nati dentro le pagine, la build corregge il kit).
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-foundations"
fail() { echo "FAIL $name: $1"; exit 1; }
F="$PLUGIN_ROOT/shared/fse-foundations.md"
for s in '_section.scss' 'Shared attribute vocabulary' 'headingLevel' 'token-exception' '_focus.scss' '_motion.scss' '{prefix}-swiper' '--wp--custom--shadow--' 'keywords' 'in_array(' 'aria-expanded' 'reverse' 'Six moments, three gates' 'The decision charter' '[da confermare]' 'da eliminare' '## Brief' 'kit {item} in revisione' 'build sito: pagina' 'The handover message' 'Prossimo passo' 'AGENT_ADMIN_USER' 'AGENT_ADMIN_PASSWORD' '{site-root}/.env'; do
  grep -qF -- "$s" "$F" || fail "manca '$s' nelle fondamenta"
done
v1="$(jq -r .version "$PLUGIN_ROOT/.claude-plugin/plugin.json")"
v2="$(jq -r '.plugins[0].version' "$PLUGIN_ROOT/.claude-plugin/marketplace.json")"
[ "$v1" = "1.7.0" ] && [ "$v2" = "1.7.0" ] || fail "versione plugin.json=$v1 marketplace.json=$v2, attesa 1.7.0"
echo "PASS $name"
