#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APP_CLIENT="apps/client"

if [[ -d "apps/courier" ]]; then APP_COURIER="apps/courier"
elif [[ -d "apps/coursier" ]]; then APP_COURIER="apps/coursier"
else echo "❌ courier folder not found"; exit 1; fi

if [[ -d "apps/merchant" ]]; then APP_MERCHANT="apps/merchant"
elif [[ -d "apps/marchand" ]]; then APP_MERCHANT="apps/marchand"
else echo "❌ merchant folder not found"; exit 1; fi

stamp="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_ui_folder_$stamp"
mkdir -p "$BK"

backup_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  local rel="${dir#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$dir" "$BK/$rel"
}

patch_imports_in_app() {
  local app="$1"
  local base="$ROOT/$app/app"

  # remplace "./_ui/..." par "./+ui/..."
  find "$base" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 \
    | xargs -0 sed -i 's|"\./_ui/|"\./+ui/|g; s|'\''\./_ui/|'\''\./+ui/|g'
}

move_folder() {
  local app="$1"
  local from="$ROOT/$app/app/_ui"
  local to="$ROOT/$app/app/+ui"

  echo "== $app: _ui -> +ui =="

  [[ -d "$from" ]] || { echo "⚠️  Skip: no $from"; return 0; }
  backup_dir "$from"

  rm -rf "$to" || true
  mv "$from" "$to"

  patch_imports_in_app "$app"

  echo "✅ Done: $app"
}

move_folder "$APP_CLIENT"
move_folder "$APP_COURIER"
move_folder "$APP_MERCHANT"

echo
echo "🎒 Backups: $BK"
echo "👉 Reload: dans chaque Expo (client/courier/merchant), appuie sur 'r' (ou restart pnpm dev)"
