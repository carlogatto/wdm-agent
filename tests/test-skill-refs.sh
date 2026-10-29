#!/bin/bash
# Le 6 skill fse-* citano i file del plugin via ${CLAUDE_PLUGIN_ROOT}, frontmatter solo name+description.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-skill-refs"
fail() { echo "FAIL $name: $1"; exit 1; }
S="$PLUGIN_ROOT/skills"

count() { grep -c -F -- "$1" "$2" 2>/dev/null || true; }
at_least() { [ "$(count "$1" "$2")" -ge "$3" ] || fail "$(basename "$(dirname "$2")"): attese ≥$3 occorrenze di '$1', trovate $(count "$1" "$2")"; }
exactly() { [ "$(count "$1" "$2")" -eq "$3" ] || fail "$(basename "$(dirname "$2")"): attese $3 occorrenze di '$1', trovate $(count "$1" "$2")"; }

for sk in fse-theme-setup fse-brief fse-kit fse-build fse-block-edit fse-menu-build; do
  f="$S/$sk/SKILL.md"
  [ -f "$f" ] || fail "manca $f"
  at_least '${CLAUDE_PLUGIN_ROOT}/shared/fse-foundations.md' "$f" 1
  extra="$(sed -n '2,/^---$/p' "$f" | grep -vE '^(name|description):|^---$' || true)"
  [ -z "$extra" ] || fail "$sk: frontmatter con chiavi oltre name/description: $extra"
done

NAV='eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/scripts/wp-navigation.php'
SYNC='node ${CLAUDE_PLUGIN_ROOT}/shared/scripts/sync-theme-json-tokens.js'
at_least "$NAV" "$S/fse-menu-build/SKILL.md" 4
at_least "$NAV" "$S/fse-theme-setup/SKILL.md" 2
at_least "$SYNC" "$S/fse-build/SKILL.md" 1
at_least "$SYNC" "$S/fse-block-edit/SKILL.md" 1
at_least "$SYNC" "$S/fse-theme-setup/SKILL.md" 2
at_least "$SYNC" "$S/fse-brief/SKILL.md" 1
at_least 'eval-file ${CLAUDE_PLUGIN_ROOT}/skills/fse-build/scripts/wp-page.php' "$S/fse-build/SKILL.md" 2
at_least '${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md' "$S/fse-build/SKILL.md" 1
exactly 'bash ${CLAUDE_PLUGIN_ROOT}/skills/fse-theme-setup/scripts/setup.sh' "$S/fse-theme-setup/SKILL.md" 1
exactly 'Template of `new-project-setup`' "$S/fse-theme-setup/SKILL.md" 0
at_least '${CLAUDE_PLUGIN_ROOT}/skills/fse-menu-build/SKILL.md' "$S/fse-theme-setup/SKILL.md" 1

[ -f "$S/fse-theme-setup/scripts/setup.sh" ] || fail "manca setup.sh"
[ -f "$S/fse-menu-build/scripts/wp-navigation.php" ] || fail "manca wp-navigation.php"
[ -f "$S/fse-build/scripts/wp-page.php" ] || fail "manca wp-page.php"

echo "PASS $name"
