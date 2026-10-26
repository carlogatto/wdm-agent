#!/bin/bash
# hooks.json + i due hook: solo FSE, CLAUDE_PLUGIN_ROOT dall'ambiente, percorsi con spazi, ambiente incompleto.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-hooks"
fail() { echo "FAIL $name: $1"; exit 1; }

WDM_THEME="/Users/macbookpro16m1/Sites/wdm-theme/wp-content/themes/wdm-theme"
TMP="$PLUGIN_ROOT/tests/tmp"
rm -rf "$TMP"; mkdir -p "$TMP"

for f in hooks/hooks.json hooks/check-block-contract.sh hooks/check-design-tokens.sh; do
  [ -f "$PLUGIN_ROOT/$f" ] || fail "manca $f"
done

# run_hook <root> <script> <file_path> → stdout in $out, stderr in $err, exit in $rc
run_hook() {
  local root="$1" script="$2" f="$3"
  set +e
  out="$(printf '{"tool_input":{"file_path":"%s"}}' "$f" | CLAUDE_PLUGIN_ROOT="$root" bash "$root/hooks/$script" 2>"$TMP/err")"
  rc=$?
  set -e
  err="$(cat "$TMP/err")"
}

# (h) hooks.json: due comandi PostToolUse su Write|Edit
jq -e '.hooks.PostToolUse[0].matcher == "Write|Edit" and (.hooks.PostToolUse[0].hooks | length == 2)' "$PLUGIN_ROOT/hooks/hooks.json" >/dev/null \
  || fail "(h) hooks.json non ha 2 hook PostToolUse su Write|Edit"
grep -q '\${CLAUDE_PLUGIN_ROOT}/hooks/check-block-contract.sh' "$PLUGIN_ROOT/hooks/hooks.json" || fail "(h) hooks.json senza check-block-contract via CLAUDE_PLUGIN_ROOT"
grep -q '\${CLAUDE_PLUGIN_ROOT}/hooks/check-design-tokens.sh' "$PLUGIN_ROOT/hooks/hooks.json" || fail "(h) hooks.json senza check-design-tokens via CLAUDE_PLUGIN_ROOT"

# (a) theme.json di wdm-theme (token allineati) → exit 0, stdout vuoto (o wp eval fallito a MAMP spento)
run_hook "$PLUGIN_ROOT" check-design-tokens.sh "$WDM_THEME/theme.json"
[ "$rc" -eq 0 ] || fail "(a) exit $rc su theme.json di wdm-theme. stderr: $err"
{ [ -z "$out" ] || echo "$out" | grep -q 'wp eval fallito'; } || fail "(a) stdout inatteso: $out"

# (b) theme.json di un progetto starter (DESIGN.md senza theme_family fse) → exit 0, silenzio
run_hook "$PLUGIN_ROOT" check-design-tokens.sh "$PLUGIN_ROOT/tests/fixtures/starter-site/wp-content/themes/x/theme.json"
[ "$rc" -eq 0 ] && [ -z "$out" ] || fail "(b) starter: exit $rc, stdout: $out"

# (c) _variables.scss → il ramo starter non esiste nel plugin: exit 0, silenzio
run_hook "$PLUGIN_ROOT" check-design-tokens.sh "/x/wp-content/themes/t/src/scss/bs5/_variables.scss"
[ "$rc" -eq 0 ] && [ -z "$out" ] || fail "(c) _variables.scss: exit $rc, stdout: $out"

# (i) block.json fuori da un progetto FSE (nessun DESIGN.md con theme_family fse risalendo) → exit 0 anche senza README
mkdir -p "$TMP/other/blocks/wdm-block-cta"
cp "$WDM_THEME/blocks/wdm-block-cta/block.json" "$TMP/other/blocks/wdm-block-cta/"
cp -R "$WDM_THEME/blocks/wdm-block-cta/src" "$TMP/other/blocks/wdm-block-cta/"
run_hook "$PLUGIN_ROOT" check-block-contract.sh "$TMP/other/blocks/wdm-block-cta/block.json"
[ "$rc" -eq 0 ] && [ -z "$err" ] || fail "(i) progetto non FSE: exit $rc, stderr: $err"

# (d) block.json senza README in un progetto FSE → exit 2, stderr cita README.md
mkdir -p "$TMP/fse/wp-content/themes/t/blocks/wdm-block-cta"
cp "$PLUGIN_ROOT/tests/fixtures/fse-site/DESIGN.md" "$TMP/fse/DESIGN.md"
cp "$WDM_THEME/blocks/wdm-block-cta/block.json" "$TMP/fse/wp-content/themes/t/blocks/wdm-block-cta/"
cp -R "$WDM_THEME/blocks/wdm-block-cta/src" "$TMP/fse/wp-content/themes/t/blocks/wdm-block-cta/"
run_hook "$PLUGIN_ROOT" check-block-contract.sh "$TMP/fse/wp-content/themes/t/blocks/wdm-block-cta/block.json"
[ "$rc" -eq 2 ] || fail "(d) exit $rc, atteso 2. stderr: $err"
echo "$err" | grep -q "README.md" || fail "(d) stderr non cita README.md: $err"

# (e) block.json reale di wdm-block-cta → exit 0
run_hook "$PLUGIN_ROOT" check-block-contract.sh "$WDM_THEME/blocks/wdm-block-cta/block.json"
[ "$rc" -eq 0 ] && [ -z "$err" ] || fail "(e) exit $rc, stderr: $err"

# (f) plugin in una cartella con spazi
SPACED="$TMP/dir con spazi/wdm-agent"
mkdir -p "$SPACED"
cp -R "$PLUGIN_ROOT/hooks" "$PLUGIN_ROOT/shared" "$SPACED/"
run_hook "$SPACED" check-block-contract.sh "$WDM_THEME/blocks/wdm-block-cta/block.json"
[ "$rc" -eq 0 ] && [ -z "$err" ] || fail "(f) block-contract con spazi: exit $rc, stderr: $err"
run_hook "$SPACED" check-design-tokens.sh "$WDM_THEME/theme.json"
[ "$rc" -eq 0 ] || fail "(f) design-tokens con spazi: exit $rc, stderr: $err"
{ [ -z "$out" ] || echo "$out" | grep -q 'wp eval fallito'; } || fail "(f) design-tokens con spazi, stdout inatteso: $out"
echo "$err" | grep -q 'wdm-agent hook' && fail "(f) l'hook con spazi si è lamentato dell'ambiente: $err"

# (g) CLAUDE_PLUGIN_ROOT assente → exit 0, stderr 'wdm-agent hook'
set +e
out="$(printf '{"tool_input":{"file_path":"%s"}}' "$WDM_THEME/theme.json" | env -u CLAUDE_PLUGIN_ROOT bash "$PLUGIN_ROOT/hooks/check-design-tokens.sh" 2>"$TMP/err")"; rc=$?
set -e
err="$(cat "$TMP/err")"
[ "$rc" -eq 0 ] || fail "(g) exit $rc senza CLAUDE_PLUGIN_ROOT"
echo "$err" | grep -q 'wdm-agent hook' || fail "(g) stderr senza 'wdm-agent hook': $err"

rm -rf "$TMP"
echo "PASS $name"
