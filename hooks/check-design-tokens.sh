#!/bin/bash
#
# check-design-tokens.sh — PostToolUse hook (Claude Code), shipped by the wdm-agent plugin
#
# Fires on Write|Edit; fast-exits unless the written file is the token source of an FSE theme:
#   wp-content/themes/{theme}/theme.json of a project whose DESIGN.md has `theme_family: fse`.
# (The wdm-starter branch — src/scss/bs5/_variables.scss → sync-design-tokens.js — is not part
# of this plugin: it lives with the starter family.)
# When it matches, runs shared/scripts/sync-theme-json-tokens.js --check against the project's
# DESIGN.md and, if the Design Tokens block is stale, injects a warning via
# hookSpecificOutput.additionalContext instructing the agent to show the diff to the dev and
# ask for confirmation BEFORE regenerating. The hook never writes anything itself — theme.json
# stays the single source of truth and the dev keeps the checkpoint.
#
# Registered by hooks/hooks.json; CLAUDE_PLUGIN_ROOT is exported by Claude Code to hook processes.

set -euo pipefail

# Ambiente incompleto: avvisa e non bloccare mai una Write per questo.
if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  echo "wdm-agent hook: CLAUDE_PLUGIN_ROOT non impostato; check-design-tokens saltato" >&2; exit 0
fi
command -v jq >/dev/null 2>&1 || { echo "wdm-agent hook: jq non trovato (brew install jq); check-design-tokens saltato" >&2; exit 0; }
command -v node >/dev/null 2>&1 || { echo "wdm-agent hook: node non trovato (node ≥ 18 richiesto); check-design-tokens saltato" >&2; exit 0; }

input="$(cat)"
file_path="$(jq -r '.tool_input.file_path // empty' <<< "$input")"

[ -n "$file_path" ] || exit 0

# Only fires on {theme-root}/theme.json
echo "$file_path" | grep -qE 'themes/[^/]+/theme\.json$' || exit 0

theme_root="$(dirname "$file_path")"
sync_script="$CLAUDE_PLUGIN_ROOT/shared/scripts/sync-theme-json-tokens.js"
[ -f "$sync_script" ] || { echo "wdm-agent hook: $sync_script non trovato" >&2; exit 0; }

# Only FSE projects (DESIGN.md → Project Config → theme_family: fse): every wdm-starter project
# also has a theme.json and a DESIGN.md, but its tokens come from _variables.scss.
site_root="$(cd "$theme_root/../../.." 2>/dev/null && pwd || true)"
[ -n "$site_root" ] && [ -f "$site_root/DESIGN.md" ] || exit 0
grep -qE '^\| *`theme_family` *\| *fse *\|' "$site_root/DESIGN.md" || exit 0

check_output="$(node "$sync_script" "$theme_root" --check 2>&1)" && exit 0

message="$(printf '⚠️ theme.json è stato modificato e i Design Tokens in DESIGN.md sono ora stale.\n%s\n\nPRIMA di rigenerare: mostra queste differenze al dev e chiedi conferma esplicita. Solo dopo la conferma esegui:\n  node "%s" "%s"\nSe il dev NON conferma, la modifica a theme.json va riconsiderata/ripristinata.' "$check_output" "$sync_script" "$theme_root")"

jq -n --arg msg "$message" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $msg
  }
}'
exit 0
