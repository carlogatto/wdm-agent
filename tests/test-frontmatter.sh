#!/bin/bash
# Frontmatter delle skill: YAML valido (tests/frontmatter.test.js, eseguito con node --test).
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
name="test-frontmatter"
out="$(node --test "$PLUGIN_ROOT/tests/frontmatter.test.js" 2>&1)" || { echo "$out" | grep -E '^not ok|description|apostrofo' | head -12; echo "FAIL $name"; exit 1; }
echo "PASS $name"
