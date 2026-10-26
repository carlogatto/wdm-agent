#!/bin/bash
# plugin.json e marketplace.json: campi obbligatori, nome, versione, source "./".
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-manifest"
fail() { echo "FAIL $name: $1"; exit 1; }

p="$PLUGIN_ROOT/.claude-plugin/plugin.json"
m="$PLUGIN_ROOT/.claude-plugin/marketplace.json"
[ -f "$p" ] || fail "manca $p"
[ -f "$m" ] || fail "manca $m"

jq -e '.name == "wdm-agent" and .version == "1.0.0" and (.author.name | length > 0) and (.repository | test("github.com/carlogatto/wdm-agent"))' "$p" >/dev/null \
  || fail "plugin.json: name/version/author/repository non conformi"
jq -e '.name == "wdm-agent" and .owner.name != null and (.plugins | length == 1) and .plugins[0].name == "wdm-agent" and .plugins[0].source == "./"' "$m" >/dev/null \
  || fail "marketplace.json: name/owner/plugins non conformi"

if claude plugin validate --help >/dev/null 2>&1; then
  claude plugin validate "$PLUGIN_ROOT" >/dev/null 2>&1 || fail "claude plugin validate non passa"
else
  echo "SKIP validate (sottocomando assente in questa CLI)"
fi

echo "PASS $name"
