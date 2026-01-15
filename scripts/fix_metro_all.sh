#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

cd "$ROOT"

echo "== Backup + Fix metro.config.js (CJS) + package.json type=commonjs =="

for app in "${APPS[@]}"; do
  DIR="$ROOT/apps/$app"
  PKG="$DIR/package.json"
  METRO="$DIR/metro.config.js"

  [ -d "$DIR" ] || { echo "❌ Missing dir: $DIR"; exit 1; }
  [ -f "$PKG" ] || { echo "❌ Missing: $PKG"; exit 1; }

  ts="$(date +%Y%m%d-%H%M%S)"
  if [ -f "$METRO" ]; then
    cp -a "$METRO" "$METRO.bak.$ts"
  fi

  cat > "$METRO" <<'JS'
/**
 * DelishAfrica - Metro config (CommonJS, safe in monorepo)
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
JS

  # Force "type": "commonjs" at app level (overrides any parent "type":"module")
  node - <<NODE
const fs = require('fs');
const path = "${PKG}";
const j = JSON.parse(fs.readFileSync(path, 'utf8'));
if (j.type !== "commonjs") {
  j.type = "commonjs";
  fs.writeFileSync(path, JSON.stringify(j, null, 2) + "\n");
}
NODE

  echo "✅ fixed: $app (metro.config.js + type=commonjs)"
done

echo "== Clean caches =="
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true
for app in "${APPS[@]}"; do
  rm -rf "$ROOT/apps/$app/.expo" "$ROOT/apps/$app/.metro-cache" 2>/dev/null || true
done

echo "== Install deps (workspace) =="
pnpm install --no-frozen-lockfile

echo "✅ Done. You can restart tmux script now."
