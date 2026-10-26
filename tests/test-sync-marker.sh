#!/bin/bash
# sync-theme-json-tokens.js: marker portabile (nuovo), riconoscimento del marker vecchio, rifiuto di marker estranei.
# Tutto avviene su una copia in tests/tmp/site (theme.json, _breakpoints.scss e un DESIGN.md scheletro
# senza la riga {wp-cli}, così lo script non tocca né il tema reale né WordPress). Non serve MAMP.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-sync-marker"
fail() { echo "FAIL $name: $1"; exit 1; }

SCRIPT="$PLUGIN_ROOT/shared/scripts/sync-theme-json-tokens.js"
[ -f "$SCRIPT" ] || fail "manca $SCRIPT"

REAL_THEME="${WDM_THEME:-/Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme}"
[ -f "$REAL_THEME/theme.json" ] || { echo "SKIP $name: tema wdm-theme non trovato (imposta WDM_THEME)"; echo "PASS $name"; exit 0; }

SITE="$PLUGIN_ROOT/tests/tmp/site"
THEME="$SITE/wp-content/themes/wdm-theme"
DESIGN="$SITE/DESIGN.md"
rm -rf "$SITE"; mkdir -p "$THEME/src/scss"
cp "$REAL_THEME/theme.json" "$THEME/"
cp "$REAL_THEME/src/scss/_breakpoints.scss" "$THEME/src/scss/"
cp "$PLUGIN_ROOT/tests/fixtures/fse-site/DESIGN.md" "$DESIGN"
printf '\n## Design Tokens\n\n' >> "$DESIGN"

NEW_MARKER='<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con lo script sync-theme-json-tokens.js del plugin wdm-agent -->'
OLD_MARKER='<!-- AUTO-GENERATED:design-tokens da theme.json — non editare. Rigenera con: node ~/.claude/skills/_shared/scripts/sync-theme-json-tokens.js {theme-root} -->'
FOREIGN_MARKER='<!-- AUTO-GENERATED:design-tokens da _variables.scss -->'
# swap_marker <nuovo testo del marker>: sostituisce la riga del marker in DESIGN.md
swap_marker() { python3 - "$DESIGN" "$1" <<'PY'
import sys,re
p,marker=sys.argv[1],sys.argv[2]
s=open(p).read()
s=re.sub(r'^<!-- AUTO-GENERATED:design-tokens[^\n]*$', lambda m: marker, s, count=1, flags=re.M)
open(p,'w').write(s)
PY
}
run() { set +e; out="$(node "$SCRIPT" "$THEME" "$@" 2>&1)"; rc=$?; set -e; }

# (e) nessun percorso ~/.claude nello script
[ "$(grep -c '~/.claude' "$SCRIPT" || true)" -eq 0 ] || fail "(e) lo script contiene ancora ~/.claude"

# (b) prima generazione sullo scheletro → marker nuovo, nessun percorso nella riga del marker
run; [ "$rc" -eq 0 ] || fail "(b) generazione: exit $rc. Output: $out"
grep -qF "$NEW_MARKER" "$DESIGN" || fail "(b) DESIGN.md senza il marker nuovo"
[ "$(grep '^<!-- AUTO-GENERATED' "$DESIGN" | grep -c '~/.claude')" -eq 0 ] || fail "(b) la riga del marker contiene ~/.claude"
[ ! -f "$THEME/assets/css/wp-global-styles.css" ] || fail "(b) senza {wp-cli} lo script non deve scrivere il CSS"

# (c) --check dopo la generazione → 0 senza avviso
run --check; [ "$rc" -eq 0 ] || fail "(c) --check: exit $rc. Output: $out"
echo "$out" | grep -q "OK: Design Tokens" || fail "(c) manca 'OK: Design Tokens'. Output: $out"
! echo "$out" | grep -q "marker da aggiornare" || fail "(c) avviso marker presente con marker nuovo"

# (a) marker vecchio + token allineati → exit 0 con avviso
swap_marker "$OLD_MARKER"
run --check; [ "$rc" -eq 0 ] || fail "(a) --check con marker vecchio: exit $rc, atteso 0. Output: $out"
echo "$out" | grep -q "marker da aggiornare" || fail "(a) manca l'avviso 'marker da aggiornare'. Output: $out"

# (a2) rigenerazione dal marker vecchio → marker nuovo
run; [ "$rc" -eq 0 ] || fail "(a2) rigenerazione: exit $rc. Output: $out"
grep -qF "$NEW_MARKER" "$DESIGN" || fail "(a2) il marker vecchio non è stato sostituito"

# (f) marker nuovo ma token stale → exit 1 con diff (nessuna regressione del caso normale)
python3 - "$DESIGN" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=re.sub(r'(^\s*xs: )([^\n]*)', r'\g<1>"0px"  # stale', s, count=1, flags=re.M)
open(p,'w').write(s)
PY
run --check; [ "$rc" -eq 1 ] || fail "(f) token stale: exit $rc, atteso 1. Output: $out"
echo "$out" | grep -q "STALE" || fail "(f) manca 'STALE'. Output: $out"

# (d) marker estraneo → exit 2, 'altra fonte'
swap_marker "$FOREIGN_MARKER"
run --check; [ "$rc" -eq 2 ] || fail "(d) marker estraneo: exit $rc, atteso 2. Output: $out"
echo "$out" | grep -q "altra fonte" || fail "(d) manca 'altra fonte'. Output: $out"

rm -rf "$SITE"
echo "PASS $name"
