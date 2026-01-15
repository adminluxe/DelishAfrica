#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

echo "============================================================"
echo "TONTON HARD RESET — 3 APPS (Client/Courier/Merchant)"
echo "Root: $ROOT"
echo "============================================================"

# 0) sanity
if [ ! -d "$ROOT/apps/client" ] || [ ! -d "$ROOT/apps/courier" ] || [ ! -d "$ROOT/apps/merchant" ]; then
  echo "❌ Repo apps introuvable. Vérifie: $ROOT/apps/{client,courier,merchant}"
  exit 1
fi

# 1) Stop Metro/Expo + watchers (best-effort)
echo "==> Kill metro/expo processes (best-effort)…"
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "watchman" 2>/dev/null || true

# 2) Clean caches for each app
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  echo "------------------------------------------------------------"
  echo "==> Cleaning caches: $APPDIR"
  rm -rf "$APPDIR/.expo" "$APPDIR/.expo-shared" "$APPDIR/.turbo" 2>/dev/null || true
  rm -rf "$APPDIR/node_modules/.cache" 2>/dev/null || true
  rm -rf "$APPDIR/.next" "$APPDIR/dist" 2>/dev/null || true
done

# 3) Clean global /tmp metro caches
echo "------------------------------------------------------------"
echo "==> Cleaning /tmp metro caches"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

# 4) Show API env for each app (so we know what it targets)
echo "------------------------------------------------------------"
echo "==> ENV CHECK (EXPO_PUBLIC_API_BASE_URL)"
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  ENVFILE="$APPDIR/.env"
  echo "- $a:"
  if [ -f "$ENVFILE" ]; then
    grep -n "EXPO_PUBLIC_API_BASE_URL" "$ENVFILE" || echo "  (no EXPO_PUBLIC_API_BASE_URL line)"
  else
    echo "  (no .env file)"
  fi
done

echo "------------------------------------------------------------"
echo "✅ Cache cleaned. Next: restart metros with --clear (manual in tmux)."
echo ""
echo "IMPORTANT iPhone:"
echo "1) Force close Expo Go COMPLETEMENT (swipe up)."
echo "2) Re-scan QR (new tunnel) for each app."
echo ""
echo "Commands to run (one per tmux window):"
echo "  CLIENT  : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER : cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
echo "  MERCHANT: cd $ROOT/apps/merchant&& pnpm dev -- --tunnel --port 8083 --clear"
echo "------------------------------------------------------------"
