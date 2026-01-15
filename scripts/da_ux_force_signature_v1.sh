#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backup_force_signature_$TS"

echo "== Force Signature Screens (ui/ui.tsx) =="
echo "Backup: $BACKUP"
mkdir -p "$BACKUP"

APP_CLIENT="$ROOT/apps/client"
APP_MERCHANT="$ROOT/apps/merchant"
APP_COURIER="$ROOT/apps/courier"
if [ ! -d "$APP_COURIER" ] && [ -d "$ROOT/apps/coursier" ]; then
  APP_COURIER="$ROOT/apps/coursier"
fi

for d in "$APP_CLIENT" "$APP_MERCHANT" "$APP_COURIER"; do
  [ -d "$d" ] || { echo "ERROR: missing app folder: $d"; exit 1; }
done

backup_and_write() {
  local APP="$1"
  local SIGNATURE="$2"
  local UI_FILE="$APP/ui/ui.tsx"

  mkdir -p "$BACKUP/$(basename "$APP")/ui"
  if [ -f "$UI_FILE" ]; then
    cp -a "$UI_FILE" "$BACKUP/$(basename "$APP")/ui/ui.tsx"
  fi

  cat > "$UI_FILE" <<TSX
import React from "react";
import Signature from "./screens/${SIGNATURE}";

export default function UI() {
  return <Signature />;
}
TSX

  echo "Patched: $UI_FILE -> ${SIGNATURE}"
}

backup_and_write "$APP_CLIENT" "SignatureHomeClient"
backup_and_write "$APP_MERCHANT" "SignatureHomeMerchant"
backup_and_write "$APP_COURIER" "SignatureHomeCourier"

echo "== DONE =="
echo "Backup saved at: $BACKUP"
