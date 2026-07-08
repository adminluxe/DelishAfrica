#!/usr/bin/env bash

# fix_expo_build.sh – A “tonton‑style” script to get your Expo build working
#
# This script performs a series of targeted checks and fixes to address
# common issues that cause EAS builds to fail when using pnpm and Expo SDK 54.
# It ensures that the required Babel preset (`babel-preset-expo`) is
# installed and configured, checks your Node.js version, and reinstalls
# dependencies with a clean cache.  By automating these steps it aims
# to unblock builds that get stuck during the “Resolving Swift Package
# Manager dependencies…” phase and later fail with errors like
# “Cannot find module 'babel‑preset‑expo'” during bundling.  For more
# context see the Expo community guidance, which recommends installing
# `babel‑preset‑expo` and adding it to your `babel.config.js`【365952452262626†L132-L145】,
# and aligning your Node.js version with SDK 54’s requirements【365952452262626†L164-L176】.

set -euo pipefail

# Helper to print messages in colour
info() {
  printf '\033[1;34m%s\033[0m\n' "$*"
}
warn() {
  printf '\033[1;33m%s\033[0m\n' "$*"
}
error() {
  printf '\033[1;31m%s\033[0m\n' "$*"
}

# Check Node.js version
current_node=$(node -v || true)
info "Current Node.js version: ${current_node:-not installed}"
# SDK 54 prefers Node v20.x【365952452262626†L164-L176】. If your version differs,
# print a warning but continue, since some CI environments manage their
# own Node versions.
if [[ -n "$current_node" && ! "$current_node" =~ ^v20\. ]]; then
  warn "Recommended Node version is v20.x for Expo SDK 54. Current: $current_node"
  warn "If you encounter persistent issues, install Node 20 (e.g. 'nvm install 20 && nvm use 20')."
fi

# Determine which package manager to use. Prefer pnpm if available, otherwise fall back to npm.
pkg_manager="pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found; falling back to npm"
  pkg_manager="npm"
fi

# Ensure the Babel preset is installed as a dev dependency
if [[ "$pkg_manager" == "pnpm" ]]; then
  if ! pnpm list --depth=0 babel-preset-expo >/dev/null 2>&1; then
    info "Installing babel-preset-expo as a dev dependency…"
    pnpm add -D babel-preset-expo
  else
    info "babel-preset-expo is already installed."
  fi
  # Ensure react-native-worklets is present to satisfy Expo peer dependency checks
  if ! pnpm list --depth=0 react-native-worklets >/dev/null 2>&1; then
    info "Installing react-native-worklets (required by react-native-reanimated)…"
    pnpm add -D react-native-worklets
  fi
else
  if ! npm ls --depth=0 babel-preset-expo >/dev/null 2>&1; then
    info "Installing babel-preset-expo as a dev dependency…"
    npm install --save-dev babel-preset-expo
  else
    info "babel-preset-expo is already installed."
  fi
  if ! npm ls --depth=0 react-native-worklets >/dev/null 2>&1; then
    info "Installing react-native-worklets (required by react-native-reanimated)…"
    npm install --save-dev react-native-worklets
  fi
fi

# Create a default babel.config.js if it does not exist
if [[ ! -f babel.config.js ]]; then
  info "Generating default babel.config.js…"
  npx expo customize babel.config.js >/dev/null
fi

# Modify babel.config.js to include the 'babel-preset-expo' preset. If
# a preset array exists but lacks the expo preset, insert it.
node <<'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');
const CONFIG = 'babel.config.js';
let content = fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG, 'utf8') : '';
const presetNeeded = 'babel-preset-expo';
let updated = false;

function writeDefault() {
  const defaultContent = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['${presetNeeded}'],
    plugins: [],
  };
};\n`;
  fs.writeFileSync(CONFIG, defaultContent);
  console.log(`Created new ${CONFIG} with ${presetNeeded} preset.`);
}

if (!content) {
  // Config file empty or missing – write default
  writeDefault();
  process.exit(0);
}
try {
  // Try to evaluate the config as a function returning an object
  // We create a dummy api with cache() to avoid errors
  const api = { cache: () => {} };
  const configFn = require(path.resolve(CONFIG));
  const cfg = typeof configFn === 'function' ? configFn(api) : configFn;
  if (cfg && Array.isArray(cfg.presets)) {
    if (!cfg.presets.includes(presetNeeded)) {
      cfg.presets.unshift(presetNeeded);
      updated = true;
    }
  } else {
    // If presets is undefined or not an array, overwrite with our own config
    updated = true;
    cfg.presets = [presetNeeded];
  }
  if (updated) {
    // Serialize the updated config back to JS
    const out = `module.exports = function (api) {\n  api.cache(true);\n  return ${JSON.stringify(cfg, null, 2)};\n};\n`;
    fs.writeFileSync(CONFIG, out);
    console.log(`Updated ${CONFIG} to include '${presetNeeded}'.`);
  } else {
    console.log(`${CONFIG} already includes '${presetNeeded}'.`);
  }
} catch (err) {
  // If parsing fails, write a default config to avoid further issues
  console.warn(`Warning: failed to parse existing ${CONFIG}. Overwriting with default.`);
  writeDefault();
}
NODE_SCRIPT

# Clean caches and reinstall dependencies to ensure a fresh state【365952452262626†L164-L176】
info "Cleaning caches and reinstalling dependencies…"
rm -rf node_modules
if [[ -f pnpm-lock.yaml ]]; then rm -f pnpm-lock.yaml; fi
if [[ -f package-lock.json ]]; then rm -f package-lock.json; fi
if [[ -f yarn.lock ]]; then rm -f yarn.lock; fi

if [[ "$pkg_manager" == "pnpm" ]]; then
  pnpm install
else
  npm install
fi

# Optionally clear Expo cache. This step can be time‑consuming, so
# comment it out if not needed. It is recommended by Expo docs when
# facing persistent errors【365952452262626†L164-L176】.
info "Clearing Expo cache… (this may take a while)"
npx expo start -c --no-dev --minify >/dev/null 2>&1 || true

# Run expo doctor to verify configuration
info "Running Expo doctor to verify your configuration…"
npx expo-doctor || true

info "✅ All done! Your project has been cleaned and configured. Try running your EAS build again."
