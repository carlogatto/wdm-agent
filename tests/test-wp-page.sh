#!/bin/bash
# wp-page.php: diff kit → WP di una pagina (plan) e scrittura della sola differenza (apply, confirm per le
# cancellazioni). Gira su una pagina di prova in bozza del sito wdm-theme reale, cancellata alla fine;
# senza WP-CLI raggiungibile → SKIP.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-wp-page"
fail() { echo "FAIL $name: $1"; exit 1; }

SCRIPT="$PLUGIN_ROOT/skills/fse-build/scripts/wp-page.php"
SITE_ROOT="${WDM_SITE:-/Users/macbookpro16m1/Sites/wdm-theme}"
[ -f "$SITE_ROOT/DESIGN.md" ] || { echo "SKIP $name: sito wdm-theme non trovato (imposta WDM_SITE)"; echo "PASS $name"; exit 0; }
WPCLI="$(grep -F '| `{wp-cli}` |' "$SITE_ROOT/DESIGN.md" | awk -F'|' '{print $3}' | xargs)"
[ -n "$WPCLI" ] || { echo "SKIP $name: riga {wp-cli} assente in DESIGN.md"; echo "PASS $name"; exit 0; }
wp() { $WPCLI "$@"; }
wp option get home >/dev/null 2>&1 || { echo "SKIP $name: WordPress non raggiungibile"; echo "PASS $name"; exit 0; }

TMP="$PLUGIN_ROOT/tests/tmp"; mkdir -p "$TMP"
SLUG="wdm-agent-test-$$"
ID="$(wp post create --post_type=page --post_status=draft --post_title="wdm-agent test $$" --post_name="$SLUG" --porcelain)"
CID=""
cleanup() { [ -n "$CID" ] && wp post delete "$CID" --force >/dev/null 2>&1; wp post delete "$ID" --force >/dev/null 2>&1 || true; rm -f "$TMP/page-g.html"; }
trap cleanup EXIT

# run <plan|apply> <file> [args…] → $out (stdout+stderr), $rc
run() { set +e; out="$(wp eval-file "$SCRIPT" "$@" 2>&1)"; rc=$?; set -e; }
content() { wp post get "$ID" --field=post_content; }
expect() { echo "$out" | grep -qF -- "$2" || fail "$1: manca '$2'. Output: $out"; }

G="$TMP/page-g.html"
CTA='<!-- wp:wdm/cta {"variant":"split","title":"Uno"} /-->'
PAR='<!-- wp:paragraph --><p>Due</p><!-- /wp:paragraph -->'

# (a) pagina vuota → 2 nuovo; apply scrive; secondo plan 0 differenze; apply senza differenze non tocca post_modified
printf '%s\n\n%s\n' "$CTA" "$PAR" > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(a) plan: exit $rc, atteso 1. $out"
expect "(a)" "0 uguale · 0 modificato · 2 nuovo · 0 spostato · 0 da cancellare"
expect "(a)" "+ wdm/cta (split)"
run apply "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(a) apply: exit $rc, atteso 1. $out"; expect "(a)" "scritto"
run plan "$G" page="$SLUG"; [ "$rc" -eq 0 ] || fail "(a) secondo plan: exit $rc, atteso 0. $out"; expect "(a)" "2 uguale"
MOD1="$(wp post get "$ID" --field=post_modified)"
sleep 1
run apply "$G" page="$SLUG"; [ "$rc" -eq 0 ] || fail "(a) apply senza differenze: exit $rc. $out"; expect "(a)" "0 differenze, nessuna scrittura"
[ "$(wp post get "$ID" --field=post_modified)" = "$MOD1" ] || fail "(a) post_modified cambiato senza differenze"

# (b) attributo modificato → modificato, prima → dopo; apply scrive il valore del kit
printf '%s\n\n%s\n' '<!-- wp:wdm/cta {"variant":"split","title":"Uno bis"} /-->' "$PAR" > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(b) plan: exit $rc. $out"
expect "(b)" "1 uguale · 1 modificato · 0 nuovo"
expect "(b)" '~ wdm/cta (split)'; expect "(b)" 'title "Uno" → "Uno bis"'
run apply "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(b) apply: exit $rc. $out"
content | grep -qF 'Uno bis' || fail "(b) il contenuto non ha il titolo nuovo"

# (c) blocco in più in WP → da cancellare, exit 3 senza scrittura; confirm lo toglie
wp post update "$ID" --post_content="$(content)

<!-- wp:heading --><h2>Extra</h2><!-- /wp:heading -->" >/dev/null
run plan "$G" page="$SLUG"; [ "$rc" -eq 3 ] || fail "(c) plan: exit $rc, atteso 3. $out"
expect "(c)" "1 da cancellare"; expect "(c)" "- core/heading"
run apply "$G" page="$SLUG"; [ "$rc" -eq 3 ] || fail "(c) apply: exit $rc, atteso 3. $out"
content | grep -qF 'Extra' || fail "(c) apply senza confirm ha scritto"
run apply "$G" page="$SLUG" confirm; [ "$rc" -eq 1 ] || fail "(c) apply confirm: exit $rc. $out"
! content | grep -qF 'Extra' || fail "(c) confirm non ha tolto il blocco"

# (d) ordine invertito nel kit → spostato; apply riordina
printf '%s\n\n%s\n' "$PAR" '<!-- wp:wdm/cta {"variant":"split","title":"Uno bis"} /-->' > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(d) plan: exit $rc. $out"; expect "(d)" "1 uguale · 0 modificato · 0 nuovo · 1 spostato · 0 da cancellare"
run apply "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(d) apply: exit $rc. $out"
content | head -1 | grep -qF '<!-- wp:paragraph' || fail "(d) il paragrafo non è primo"

# (e) pagina assente o post di altro tipo → exit 2
run plan "$G" page="slug-che-non-esiste-$$"; [ "$rc" -eq 2 ] || fail "(e) slug inesistente: exit $rc. $out"; expect "(e)" "pagina assente"
run plan "$G" page=1; [ "$rc" -eq 2 ] || fail "(e) post 1: exit $rc. $out"; expect "(e)" "non è una pagina"

# (f) differenza solo nel figlio → il padre è modificato
HERO_A='<!-- wp:wdm/hero {"variant":"image"} --><!-- wp:wdm/hero-slide {"title":"A"} /--><!-- /wp:wdm/hero -->'
HERO_B='<!-- wp:wdm/hero {"variant":"image"} --><!-- wp:wdm/hero-slide {"title":"B"} /--><!-- /wp:wdm/hero -->'
printf '%s\n' "$HERO_A" > "$G"
run apply "$G" page="$SLUG" confirm; [ "$rc" -eq 1 ] || fail "(f) setup: exit $rc. $out"
printf '%s\n' "$HERO_B" > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 1 ] || fail "(f) plan: exit $rc. $out"
expect "(f)" "0 uguale · 1 modificato · 0 nuovo"; expect "(f)" "~ wdm/hero (image)"

# (g) contenuto libero in WP → da cancellare, mai scartato in silenzio
wp post update "$ID" --post_content='<p>libero</p>' >/dev/null
run plan "$G" page="$SLUG"; [ "$rc" -eq 3 ] || fail "(g) plan: exit $rc, atteso 3. $out"; expect "(g)" "- (contenuto libero)"

# (h) kit vuoto con pagina piena → tutto da cancellare; solo confirm svuota
run apply "$G" page="$SLUG" confirm >/dev/null; [ "$rc" -eq 1 ] || fail "(h) setup: exit $rc. $out"
: > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 3 ] || fail "(h) plan: exit $rc, atteso 3. $out"; expect "(h)" "0 uguale · 0 modificato · 0 nuovo · 0 spostato · 1 da cancellare"
run apply "$G" page="$SLUG"; [ "$rc" -eq 3 ] || fail "(h) apply: exit $rc. $out"
content | grep -qF 'wp:wdm/hero' || fail "(h) apply senza confirm ha svuotato la pagina"
run apply "$G" page="$SLUG" confirm; [ "$rc" -eq 1 ] || fail "(h) apply confirm: exit $rc. $out"
[ -z "$(content)" ] || fail "(h) confirm non ha svuotato la pagina"

# (i) variante al default omessa in WP ma esplicita nel kit → stesso blocco (uguale), mai da cancellare
wp post update "$ID" --post_content='<!-- wp:wdm/hero --><!-- wp:wdm/hero-slide {"title":"A"} /--><!-- /wp:wdm/hero -->' >/dev/null
printf '%s\n' "$HERO_A" > "$G"
run plan "$G" page="$SLUG"; [ "$rc" -eq 0 ] || fail "(i) plan: exit $rc, atteso 0. $out"; expect "(i)" "1 uguale · 0 modificato · 0 nuovo · 0 spostato · 0 da cancellare"

# (j) caratteri speciali negli attributi (& < " --): round trip senza corruzione (wp_update_post vuole dati slashati)
cat > "$G" <<'EOF'
<!-- wp:wdm/cta {"variant":"split","title":"Kit \u0026 build \u003cbr\u003e \u0022ok\u0022 \u002d\u002d fine"} /-->
EOF
run apply "$G" page="$SLUG" confirm; [ "$rc" -eq 1 ] || fail "(j) apply: exit $rc. $out"
run plan "$G" page="$SLUG"; [ "$rc" -eq 0 ] || fail "(j) round trip: exit $rc, atteso 0 (attributi corrotti in scrittura). $out"
content | grep -qF 'Kit \u0026 build' || fail "(j) il contenuto salvato non conserva le sequenze \\u00xx"

# (k) pagina figlia: page=<slug> la trova anche senza il percorso del genitore
CHILD="wdm-agent-child-$$"
CID="$(wp post create --post_type=page --post_status=draft --post_parent="$ID" --post_title="wdm-agent child $$" --post_name="$CHILD" --porcelain)"
run plan "$G" page="$CHILD"; [ "$rc" -eq 1 ] || fail "(k) pagina figlia per slug: exit $rc, atteso 1. $out"; expect "(k)" "$CHILD (id $CID)"
run plan "$G" page="$SLUG/$CHILD"; [ "$rc" -eq 1 ] || fail "(k) pagina figlia per percorso: exit $rc, atteso 1. $out"
wp post delete "$CID" --force >/dev/null; CID=""

echo "PASS $name"
