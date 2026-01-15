#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

APPS=("apps/client" "apps/courier" "apps/merchant")

echo "=== [DA] SharedArrayBuffer fix v3 ==="
echo "ROOT=$ROOT"
echo

for APP in "${APPS[@]}"; do
  APP_DIR="$ROOT/$APP"
  PKG="$APP_DIR/package.json"
  if [[ ! -d "$APP_DIR" ]]; then
    echo ">>> $APP : (skip, dossier absent)"
    echo
    continue
  fi
  if [[ ! -f "$PKG" ]]; then
    echo ">>> $APP : (skip, package.json absent)"
    echo
    continue
  fi

  echo ">>> $APP"

  # 1) polyfills.js (robuste pour Hermes)
  if [[ -f "$APP_DIR/polyfills.js" ]]; then
    cp -f "$APP_DIR/polyfills.js" "$APP_DIR/polyfills.js.bak.$(date +%Y%m%d_%H%M%S)"
  fi

  cat > "$APP_DIR/polyfills.js" <<'EOF'
/**
 * Polyfills globaux pour React Native / Hermes
 * Objectif: éviter le crash si SharedArrayBuffer n'existe pas.
 */
(() => {
  const g = (typeof globalThis !== 'undefined')
    ? globalThis
    : (typeof global !== 'undefined' ? global : this);

  if (!('SharedArrayBuffer' in g)) {
    Object.defineProperty(g, 'SharedArrayBuffer', {
      value: g.ArrayBuffer,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
})();
EOF
  echo "✅ polyfills.js -> OK"

  # 2) Wrapper entry.sharedarraybuffer.js (si vous utilisez expo-router/entry)
  #    On le met pour être sûr, même si Metro va charger polyfills avant main.
  if [[ -f "$APP_DIR/entry.sharedarraybuffer.js" ]]; then
    cp -f "$APP_DIR/entry.sharedarraybuffer.js" "$APP_DIR/entry.sharedarraybuffer.js.bak.$(date +%Y%m%d_%H%M%S)"
  fi

  cat > "$APP_DIR/entry.sharedarraybuffer.js" <<'EOF'
/**
 * Entry wrapper (auto-généré)
 * Injecte polyfills avant de charger expo-router/entry
 */
require('./polyfills');
module.exports = require('expo-router/entry');
EOF
  echo "✅ entry.sharedarraybuffer.js -> OK"

  # 3) package.json -> main = entry.sharedarraybuffer.js
  cp -f "$PKG" "$PKG.bak.$(date +%Y%m%d_%H%M%S)"
  node - <<NODE
const fs = require('fs');
const pkgPath = ${PKG@Q};
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.main = 'entry.sharedarraybuffer.js';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE
  echo "✅ package.json main -> entry.sharedarraybuffer.js"

  # 4) metro.config.js -> force polyfills avant main (LE point clé)
  #    Si un metro.config.js existe déjà, on évite de l’écraser et on crée un fichier "metro.config.da.js"
  if [[ -f "$APP_DIR/metro.config.js" ]]; then
    echo "⚠️ metro.config.js existe déjà -> je ne l'écrase pas."
    echo "   Je crée: metro.config.da_sharedarraybuffer.js"
    OUT="$APP_DIR/metro.config.da_sharedarraybuffer.js"
  else
    OUT="$APP_DIR/metro.config.js"
  fi

  cat > "$OUT" <<'EOF'
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const original = config.serializer?.getModulesRunBeforeMainModule;

config.serializer = config.serializer || {};
config.serializer.getModulesRunBeforeMainModule = () => {
  const defaults = original ? original() : [];
  // Important: notre polyfill en tout premier
  return [require.resolve('./polyfills'), ...defaults];
};

module.exports = config;
EOF
  echo "✅ $(basename "$OUT") -> OK"
  echo
done

echo "=== OK ==="
echo "Prochaines étapes:"
echo "1) Stoppe Metro (Ctrl+C) + assure-toi qu'il n'y en a pas 2 qui tournent."
echo "2) Relance avec cache clean: expo start --dev-client -c"
echo "3) Sur iPhone: force-quit l'app puis relance via le QR."
