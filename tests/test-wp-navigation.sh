#!/bin/bash
# wp-navigation.php: le voci con & o " arrivano intatte nel post wp_navigation (wp_insert_post e
# wp_update_post vogliono dati slashati) e un secondo apply risponde "0 differenze".
# Scrive in WordPress: gira solo su un sito di prova indicato con WDM_SITE (cartella con un
# DESIGN.md che contiene la riga {wp-cli}); senza WDM_SITE → SKIP.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-wp-navigation"
fail() { echo "FAIL $name: $1"; exit 1; }

SCRIPT="$PLUGIN_ROOT/skills/fse-menu-build/scripts/wp-navigation.php"
[ -n "${WDM_SITE:-}" ] && [ -f "$WDM_SITE/DESIGN.md" ] || { echo "SKIP $name: sito di prova non indicato (imposta WDM_SITE)"; echo "PASS $name"; exit 0; }
WPCLI="$(grep -F '| `{wp-cli}` |' "$WDM_SITE/DESIGN.md" | awk -F'|' '{print $3}' | xargs)"
[ -n "$WPCLI" ] || { echo "SKIP $name: riga {wp-cli} assente in DESIGN.md"; echo "PASS $name"; exit 0; }
wp() { $WPCLI "$@"; }
wp option get home >/dev/null 2>&1 || { echo "SKIP $name: WordPress non raggiungibile"; echo "PASS $name"; exit 0; }

TMP="$PLUGIN_ROOT/tests/tmp/nav-$$"; mkdir -p "$TMP/parts"
TITLE="wdm-agent test nav $$"
ID=""
cleanup() { [ -n "$ID" ] && wp post delete "$ID" --force >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

cat > "$TMP/header.kit" <<KIT
<nav aria-label="$TITLE"><ul>
  <li><a href="#">Privacy &amp; Cookie</a></li>
  <li><a href="#">Chi "siamo"</a></li>
</ul></nav>
KIT
printf '<!-- wp:navigation {"overlayMenu":"never"} /-->\n' > "$TMP/parts/header.html"

# run <args…> → $out (stdout+stderr), $rc
run() { set +e; out="$(wp eval-file "$SCRIPT" "$@" 2>&1)"; rc=$?; set -e; }

wp eval-file "$SCRIPT" plan header="$TMP/header.kit" > "$TMP/plan.json" 2>/dev/null || fail "plan: exit $?"

run apply "$TMP/plan.json" parts="$TMP/parts"
[ "$rc" -eq 0 ] || fail "(a) primo apply: exit $rc. $out"
echo "$out" | grep -qF "creato" || fail "(a) primo apply: menu non creato. $out"
ID="$(grep -oE '"ref":[0-9]+' "$TMP/parts/header.html" | grep -oE '[0-9]+' || true)"
[ -n "$ID" ] || fail "(a) ref non scritto nella part"

# (b) il contenuto salvato conserva le sequenze di escape JSON di & e " (barra + u0026, barra + u0022)
BS='\'
content="$(wp post get "$ID" --field=post_content)"
printf '%s\n' "$content" | grep -qF "Privacy ${BS}u0026 Cookie" || fail "(b) «Privacy & Cookie» corrotta nel post: $content"
printf '%s\n' "$content" | grep -qF "Chi ${BS}u0022siamo${BS}u0022" || fail "(b) le virgolette sono corrotte nel post: $content"

# (c) secondo apply: niente da scrivere
run apply "$TMP/plan.json" parts="$TMP/parts"
[ "$rc" -eq 0 ] || fail "(c) secondo apply: exit $rc, atteso 0. $out"
echo "$out" | grep -qF "0 differenze" || fail "(c) secondo apply: atteso «0 differenze». $out"

# (d) aggiornamento di un menu esistente (wp_update_post): stessa garanzia
sed -i.bak 's/Privacy &amp; Cookie/Privacy, Cookie \&amp; Termini/' "$TMP/header.kit"
wp eval-file "$SCRIPT" plan header="$TMP/header.kit" > "$TMP/plan.json" 2>/dev/null || fail "plan (d): exit $?"
run apply "$TMP/plan.json" parts="$TMP/parts" confirm
[ "$rc" -eq 0 ] || fail "(d) apply confirm: exit $rc. $out"
run apply "$TMP/plan.json" parts="$TMP/parts"
[ "$rc" -eq 0 ] || fail "(d) apply dopo l'aggiornamento: exit $rc, atteso 0. $out"
echo "$out" | grep -qF "0 differenze" || fail "(d) atteso «0 differenze» dopo l'aggiornamento. $out"

echo "PASS $name"
