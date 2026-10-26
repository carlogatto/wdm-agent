#!/bin/bash
#
# check-block-contract.sh — PostToolUse hook (Claude Code)
#
# Terzo hook della famiglia (check-build-registration.sh, check-design-tokens.sh). Fires on
# Write|Edit; fast-exits unless the written file is blocks/{block-folder}/block.json of a
# native block (a block.json with an `acf` key belongs to wdm-starter and is ignored).
# Checks the block contract of wdm-theme (fse-foundations.md):
#   - `name` = {prefix}/{slug} and the folder = {prefix}-block-{slug}
#   - `render` present (blocks are always dynamic: render.php, never save())
#   - every `file:./…` reference resolves: build outputs must have their source in src/
#     (build/index.js ← src/index.js, build/style-index.css ← src/style.scss,
#     build/index.css ← src/editor.scss, build/view.js ← src/view.js); any other path must exist
#   - README.md (the block contract) exists
#   - `version` present (cache-busting of the block CSS outside SCRIPT_DEBUG)
# On a violation the list goes to stderr and the hook exits 2 (blocking error shown to the
# agent); otherwise it exits 0 silently. Nothing is ever written.
#
# Shipped by the wdm-agent plugin (hooks/hooks.json); the block folder is derived from the
# written file's path, so it works in every wdm-theme project.

set -euo pipefail

# Ambiente incompleto: avvisa e non bloccare mai una Write per questo.
command -v jq >/dev/null 2>&1 || { echo "wdm-agent hook: jq non trovato (brew install jq); check-block-contract saltato" >&2; exit 0; }

input="$(cat)"
file_path="$(jq -r '.tool_input.file_path // empty' <<< "$input")"

[ -n "$file_path" ] || exit 0

# Only fires on blocks/{block-folder}/block.json
if ! echo "$file_path" | grep -qE 'blocks/[^/]+/block\.json$'; then
  exit 0
fi

[ -f "$file_path" ] || exit 0

block_dir="$(dirname "$file_path")"

# Only FSE projects: the plugin is installed user-wide, so a block.json of any other project
# (a @wordpress/create-block plugin, a static block, wdm-starter) must not be judged by this
# contract. Walk up from the block folder to the first DESIGN.md and require `theme_family: fse`.
site_root="$block_dir"
while [ "$site_root" != "/" ] && [ ! -f "$site_root/DESIGN.md" ]; do
  site_root="$(dirname "$site_root")"
done
[ -f "$site_root/DESIGN.md" ] || exit 0
grep -qE '^\| *`theme_family` *\| *fse *\|' "$site_root/DESIGN.md" || exit 0
folder="$(basename "$block_dir")"

if ! jq -e . "$file_path" >/dev/null 2>&1; then
  echo "❌ check-block-contract: $file_path non è JSON valido." >&2
  exit 2
fi

# Blocco ACF dello starter (wdm-starter): contratto diverso, fuori scope
if jq -e '.acf' "$file_path" >/dev/null 2>&1; then
  exit 0
fi

problems=()

name="$(jq -r '.name // empty' "$file_path")"
if [ -z "$name" ]; then
  problems+=("manca \"name\"")
else
  prefix="${name%%/*}"
  slug="${name#*/}"
  expected_folder="${prefix}-block-${slug}"
  if [ "$folder" != "$expected_folder" ]; then
    problems+=("name \"$name\" ↔ cartella \"$folder\": attesa \"$expected_folder\" (cartella = {prefix}-block-{slug}, name = {prefix}/{slug})")
  fi
fi

if [ -z "$(jq -r '.render // empty' "$file_path")" ]; then
  problems+=("manca \"render\": \"file:./render.php\" — i blocchi sono sempre dinamici (render.php), mai save()")
fi

# Ogni riferimento file:./… (string o array, es. "style": ["wdm-swiper", "file:./build/style-index.css"])
refs="$(jq -r '[.render, .editorScript, .script, .viewScript, .viewScriptModule, .style, .editorStyle, .viewStyle] | flatten | .[]? | select(type == "string") | select(startswith("file:"))' "$file_path")"
for ref in $refs; do
  rel="${ref#file:}"
  rel="${rel#./}"
  case "$rel" in
    build/index.js)        src="src/index.js" ;;
    build/style-index.css) src="src/style.scss" ;;
    build/index.css)       src="src/editor.scss" ;;
    build/view.js)         src="src/view.js" ;;
    build/*)               src="" ; problems+=("\"$ref\": output di build non previsto dalla pipeline (ammessi: build/index.js, style-index.css, index.css, view.js)") ;;
    *)                     src="$rel" ;;
  esac
  if [ -n "$src" ] && [ ! -f "$block_dir/$src" ]; then
    if [ "$src" = "$rel" ]; then
      problems+=("\"$ref\": file assente ($src)")
    else
      problems+=("\"$ref\": manca il sorgente $src (build.js lo genera da lì)")
    fi
  fi
done

[ -f "$block_dir/README.md" ] || problems+=("manca README.md (il contratto del blocco: scopo, varianti, attributi, figli, markup, dipendenze)")

if ! jq -e '.version' "$file_path" >/dev/null 2>&1; then
  problems+=("manca \"version\": fuori da SCRIPT_DEBUG il CSS del blocco è versionato solo con questa chiave (alzarla a ogni release)")
fi

[ "${#problems[@]}" -eq 0 ] && exit 0

{
  echo "❌ check-block-contract: $folder/block.json viola il contratto del blocco (fse-foundations.md):"
  for p in "${problems[@]}"; do
    echo "  - $p"
  done
  echo "Sistema il blocco prima di proseguire (npm run build non compila i file mancanti)."
} >&2
exit 2
