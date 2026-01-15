#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "=== [DA] Patch Metro root SharedArrayBuffer ==="
echo "ROOT=$ROOT"
echo

cd "$ROOT"

# 1) On s'assure d'avoir les polyfills dans les apps (au cas où)
for APP in apps/client apps/courier apps/merchant; do
  APP_DIR="$ROOT/$APP"
  if [[ ! -d "$APP_DIR" ]]; then
    echo ">>> $APP (skip, dossier absent)"
    continue
  fi

  if [[ ! -f "$APP_DIR/polyfills.js" ]]; then
    cat > "$APP_DIR/polyfills.js" <<'EOF'
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
    echo "✅ $APP/polyfills.js créé"
  else
    echo "✅ $APP/polyfills.js déjà présent"
  fi
done

echo

# 2) On prépare un "base" Metro config si besoin
BASE_FILE=""
if [[ -f metro.config.base.js ]]; then
  BASE_FILE="metro.config.base.js"
elif [[ -f metro.config.js ]]; then
  mv metro.config.js metro.config.base.js
  BASE_FILE="metro.config.base.js"
  echo "📦 metro.config.js renommé en metro.config.base.js (backup)"
else
  echo "ℹ️ Aucun metro.config.js existant, on va en créer un nouveau."
fi

# 3) On recrée metro.config.js qui charge la base + injecte notre polyfill
if [[ -n "$BASE_FILE" ]]; then
  cat > metro.config.js <<'EOF'
const path = require('path');

let base = require('./metro.config.base.js');
const config = typeof base === 'function' ? base() : base;

const polyfills = [
  path.resolve(__dirname, 'apps/client/polyfills.js'),
  path.resolve(__dirname, 'apps/courier/polyfills.js'),
  path.resolve(__dirname, 'apps/merchant/polyfills.js'),
];

config.serializer = config.serializer || {};
const original = config.serializer.getModulesRunBeforeMainModule;

config.serializer.getModulesRunBeforeMainModule = () => {
  const defaults = original ? original() : [];
  return [...polyfills, ...defaults];
};

module.exports = config;
EOF
  echo "✅ metro.config.js recréé (avec base + polyfills avant main)"
else
  cat > metro.config.js <<'EOF'
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const polyfills = [
  path.resolve(__dirname, 'apps/client/polyfills.js'),
  path.resolve(__dirname, 'apps/courier/polyfills.js'),
  path.resolve(__dirname, 'apps/merchant/polyfills.js'),
];

config.serializer = config.serializer || {};
const original = config.serializer.getModulesRunBeforeMainModule;

config.serializer.getModulesRunBeforeMainModule = () => {
  const defaults = original ? original() : [];
  return [...polyfills, ...defaults];
};

module.exports = config;
EOF
  echo "✅ metro.config.js créé (config Expo par défaut + polyfills avant main)"
fi

echo
echo "=== Terminé ==="
echo "Maintenant :"
echo "1) Stoppe Metro (Ctrl+C s'il tourne)."
echo "2) Relance depuis l'app (ex: apps/client) avec cache clean."
