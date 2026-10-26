#!/bin/bash
#
# fse-theme-setup — deterministic rename of wdm-theme (block theme, FSE) into a new client
# project. Twin of new-project-setup/scripts/setup.sh (wdm-starter), without the ACF steps.
#
# Covers the deterministic rename phase of fse-theme-setup (SKILL.md):
#   theme folder rename, text domain (wdm-theme → {textdomain}), project title ("WDM Theme" →
#   {category}), prefixes (wdm- / wdm_ / wdm/ / "wdm" → {prefix}), pattern Categories, block
#   folders and kit/pattern file names, build.js proxy, site-root .gitignore and DESIGN.md
#   residuals, cleanup of generated files (build/, html/, compiled css/js), wp-cli.phar
#   download, final residual check.
#
# CLAUDE.md is NOT touched (it resolves {prefix}/{theme-root} at read time from DESIGN.md).
# Hooks ship with the wdm-agent plugin (hooks/hooks.json), not with the theme. [MANUAL] steps stay in SKILL.md.
# Compatible with bash 3.2 (macOS default) and BSD sed. Never runs git.

set -euo pipefail
shopt -s nullglob

usage() {
  cat <<'USAGE'
Usage: setup.sh --prefix <p> --slug <s> --textdomain <td> --category <Title> --local-url <url> --target <site-root>

  --prefix      lowercase prefix without hyphens (e.g. abc) — replaces "wdm" (wdm-, wdm_, wdm/, "wdm")
  --slug        project slug = theme folder name (e.g. pincopallino)
  --textdomain  text domain (e.g. pincopallino) — replaces "wdm-theme"
  --category    project title shown as block/pattern category and Theme Name (e.g. "Pinco Pallino") — replaces "WDM Theme"
  --local-url   local dev URL (e.g. https://pincopallino.local:8890/) — build.js proxy
  --target      absolute path to the site root (contains wp-content/)
USAGE
}

PREFIX="" ; SLUG="" ; TEXTDOMAIN="" ; CATEGORY="" ; LOCAL_URL="" ; TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)     PREFIX="$2";     shift 2;;
    --slug)       SLUG="$2";       shift 2;;
    --textdomain) TEXTDOMAIN="$2"; shift 2;;
    --category)   CATEGORY="$2";   shift 2;;
    --local-url)  LOCAL_URL="$2";  shift 2;;
    --target)     TARGET="$2";     shift 2;;
    -h|--help)    usage; exit 0;;
    *) echo "ERROR: unknown argument: $1" >&2; usage; exit 2;;
  esac
done

miss=""
[ -n "$PREFIX" ]     || miss="$miss --prefix"
[ -n "$SLUG" ]       || miss="$miss --slug"
[ -n "$TEXTDOMAIN" ] || miss="$miss --textdomain"
[ -n "$CATEGORY" ]   || miss="$miss --category"
[ -n "$LOCAL_URL" ]  || miss="$miss --local-url"
[ -n "$TARGET" ]     || miss="$miss --target"
if [ -n "$miss" ]; then
  echo "ERROR: missing arguments:$miss" >&2
  usage; exit 2
fi
# --- validate values (all before any mv: a failure here leaves the target untouched) ---
case "$PREFIX" in
  *[!a-z0-9]*|*wdm*) echo "ERRORE: --prefix deve essere minuscolo, alfanumerico e non contenere 'wdm' (ricevuto: $PREFIX)" >&2; exit 2;;
esac
case "$PREFIX" in [a-z]*) ;; *) echo "ERRORE: --prefix deve iniziare con una lettera (ricevuto: $PREFIX)" >&2; exit 2;; esac
for kv in "slug=$SLUG" "textdomain=$TEXTDOMAIN"; do
  case "${kv#*=}" in
    *[!a-z0-9-]*|-*|*wdm*) echo "ERRORE: --${kv%%=*} deve essere kebab-case (a-z, 0-9, -) e non contenere 'wdm' (ricevuto: ${kv#*=})" >&2; exit 2;;
  esac
done
case "$LOCAL_URL" in https://*/|http://*/) ;; *) echo "ERRORE: --local-url deve essere un URL http(s) con slash finale (ricevuto: $LOCAL_URL)" >&2; exit 2;; esac

PREFIX_UPPER="$(printf '%s' "$PREFIX" | tr '[:lower:]' '[:upper:]')"

# sed replacement strings: escape the characters that would be interpreted (\ & / | #)
esc() { printf '%s' "$1" | sed -e 's/[\\&/|#]/\\&/g'; }
E_TEXTDOMAIN="$(esc "$TEXTDOMAIN")"; E_CATEGORY="$(esc "$CATEGORY")"; E_LOCAL_URL="$(esc "$LOCAL_URL")"; E_SLUG="$(esc "$SLUG")"

# --- guards (anti-scaffold / anti-double-run) ---
[ -d "$TARGET" ] || { echo "ERRORE: --target non è una directory: $TARGET" >&2; exit 3; }
STARTER="$TARGET/wp-content/themes/wdm-theme"
THEME="$TARGET/wp-content/themes/$SLUG"
if [ ! -d "$STARTER" ]; then
  if [ -d "$THEME" ]; then
    echo "ERRORE: 'wdm-theme' sembra già rinominato in '$SLUG' — lo script è probabilmente già stato eseguito. Esco senza modificare nulla." >&2
  else
    echo "ERRORE: 'wdm-theme' non trovato in $TARGET/wp-content/themes/." >&2
    echo "        Questo script RINOMINA lo starter — non crea un tema da zero. Esco." >&2
  fi
  exit 3
fi

echo "▶ Rinomino wdm-theme → $SLUG  (prefisso: wdm → $PREFIX, text domain: $TEXTDOMAIN, titolo: $CATEGORY)"

# === Step 1 — rename theme folder ===
mv "$STARTER" "$THEME"
echo "  ✓ 1  theme folder: wdm-theme → $SLUG"
cd "$THEME"

# === Step 2 — clean up generated files first (rebuilt by npm run build; they would only add sed work) ===
for d in blocks/*/build; do rm -rf "$d"; done
if [ -d html ]; then find html -name "*.html" -delete; fi
find assets/css -type f \( -name "main.css" -o -name "fonts.css" -o -name "swiper.css" -o -name "*.map" \) -delete 2>/dev/null || true
find assets/js -type f \( -name "*.js" -o -name "*.map" \) -delete 2>/dev/null || true
echo "  ✓ 2  generated files removed (blocks/*/build, html/*.html, compiled css/js)"

# helper: sed in-place on every text file of the theme (node_modules excluded)
TEXT_FILES=( -type f \( -name "*.php" -o -name "*.json" -o -name "*.js" -o -name "*.scss" -o -name "*.css" -o -name "*.kit" -o -name "*.md" -o -name "*.html" \) -not -path "*/node_modules/*" )
sedall() { # sedall <sed-expr>
  find . "${TEXT_FILES[@]}" -exec sed -i '' "$1" {} +
}
sedfile() { # sedfile <sed-expr> <file> — no-op if the file does not exist
  if [ -f "$2" ]; then sed -i '' "$1" "$2"; fi
}

# === Step 3 — text domain / folder name (most specific first) ===
sedall "s/wdm-theme/$E_TEXTDOMAIN/g"
echo "  ✓ 3  text domain: wdm-theme → $TEXTDOMAIN"

# === Step 4 — project title (Theme Name, block/pattern category title, kit/footer texts) ===
sedall "s/WDM Theme/$E_CATEGORY/g"
echo "  ✓ 4  titolo: WDM Theme → $CATEGORY"

# === Step 5 — prefixes: wdm- (classes, handles, folders in paths, CSS vars), wdm_ (functions), wdm/ (block names, context, pattern slugs) ===
sedall "s/wdm-/$PREFIX-/g"
sedall "s/wdm_/${PREFIX}_/g"
sedall "s#wdm/#$PREFIX/#g"
echo "  ✓ 5  prefissi wdm- / wdm_ / wdm/ → $PREFIX"

# === Step 6 — category slugs: quoted "wdm"/'wdm' (block.json, blocks.php, custom.php) and pattern headers ===
sedall "s/\"wdm\"/\"$PREFIX\"/g"
sedall "s/'wdm'/'$PREFIX'/g"
sedall "s/\`wdm\`/\`$PREFIX\`/g"
sedall "s/Categories: wdm/Categories: $PREFIX/g"   # pattern headers (unquoted) and the comments that cite them
echo "  ✓ 6  categoria blocchi/pattern → $PREFIX"

# === Step 7 — residual words: "WDM" → PREFIX upper (README headings), standalone "wdm" in docs ===
sedall "s/WDM/$PREFIX_UPPER/g"
echo "  ✓ 7  WDM → $PREFIX_UPPER"

# === Step 8 — rename block folders and files (after every content replacement) ===
for dir in blocks/wdm-block-*/; do
  mv "$dir" "${dir/wdm-block-/$PREFIX-block-}"
done
find . -type f -name "*wdm-*" -not -path "*/node_modules/*" | while IFS= read -r f; do
  mv "$f" "${f//wdm-/$PREFIX-}"
done
echo "  ✓ 8  cartelle blocco e file (kit, pattern) rinominati"

# === Step 9 — build.js proxy (step 3 turned it into {textdomain}.local; the real URL wins) ===
sedfile "s/proxy: '[^']*'/proxy: '$E_LOCAL_URL'/" build.js
echo "  ✓ 9  build.js proxy → $LOCAL_URL"

# === Step 10 — site root: .gitignore whitelist, DESIGN.md residuals (CLAUDE.md uses placeholders: untouched) ===
sedfile "s/wdm-theme/$E_SLUG/g" "$TARGET/.gitignore"
if [ -f "$TARGET/DESIGN.md" ]; then
  sed -i '' "s/wdm-theme/$E_SLUG/g; s/| wdm |/| $PREFIX |/g; s/wdm-/$PREFIX-/g; s/wdm_/${PREFIX}_/g; s#wdm/#$PREFIX/#g; s/WDM Theme/$E_CATEGORY/g" "$TARGET/DESIGN.md"
fi
echo "  ✓ 10 .gitignore e DESIGN.md della site root"

# === Step 11 — wp-cli.phar (site root) ===
if [ ! -f "$TARGET/wp-cli.phar" ]; then
  if curl -sSLo "$TARGET/wp-cli.phar" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar; then
    echo "  ✓ 11 wp-cli.phar scaricato in site root"
  else
    echo "  ⚠ 11 download wp-cli.phar fallito (scaricalo da https://wp-cli.org e mettilo in site root)"
  fi
else
  echo "  ✓ 11 wp-cli.phar già presente"
fi
if [ -f "$TARGET/.gitignore" ] && ! grep -q "^wp-cli.phar$" "$TARGET/.gitignore"; then
  echo "wp-cli.phar" >> "$TARGET/.gitignore"
fi

# === Step 12 — final residual check ===
echo ""
echo "▶ Controllo residui 'wdm'/'WDM' nel tema (node_modules escluso):"
residui="$(grep -rIn "wdm\|WDM" --exclude-dir=node_modules "$THEME" 2>/dev/null || true)"
if [ -n "$residui" ]; then
  echo "$residui"
  echo ""
  echo "⚠ Residui trovati — revisione manuale necessaria prima di procedere."
  exit 1
fi
echo "  ✓ nessun residuo"

echo ""
echo "✅ Rename completato: tema '$SLUG', prefisso '$PREFIX'."
echo "   Prossimo step (SKILL.md): cd '$THEME' && npm install && npm run build, poi attivazione e wp_navigation."
