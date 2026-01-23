#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APP_DIR="$ROOT/apps/courier"
ARCHIVE="$APP_DIR/.legacy_config_archive_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$ARCHIVE"

# Déplace uniquement les fichiers historiques connus (sans toucher aux vrais fichiers actifs)
find "$APP_DIR" -maxdepth 1 -type f \( \
  -name "*.bak.*" -o -name "*.BROKEN_*" -o -name "*.FINAL_*" \
\) -print -exec mv -v {} "$ARCHIVE/" \;

echo "✅ Archived legacy configs to: $ARCHIVE"
