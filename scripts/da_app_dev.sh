#!/usr/bin/env bash
set -euo pipefail

APP="${1:-}"
MODE="${2:---tunnel}"   # --tunnel (par défaut) ou --lan

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$APP" ]]; then
  echo "Usage: $0 {client|courier|merchant} [--tunnel|--lan]"
  exit 2
fi

# Résolution dossier (tolère FR/EN)
case "$APP" in
  client)
    CANDIDATES=("apps/client")
    PORT="8081"
    ;;
  courier|coursier)
    CANDIDATES=("apps/courier" "apps/coursier")
    PORT="8082"
    ;;
  merchant|marchand)
    CANDIDATES=("apps/merchant" "apps/marchand")
    PORT="8083"
    ;;
  *)
    echo "App inconnue: $APP"
    exit 2
    ;;
esac

APP_DIR=""
for c in "${CANDIDATES[@]}"; do
  if [[ -d "$ROOT/$c" ]]; then
    APP_DIR="$ROOT/$c"
    break
  fi
done

if [[ -z "$APP_DIR" ]]; then
  echo "Impossible de trouver le dossier de l'app '$APP'. Testé: ${CANDIDATES[*]}"
  exit 1
fi

echo "▶︎ Root    : $ROOT"
echo "▶︎ App     : $APP ($APP_DIR)"
echo "▶︎ Port    : $PORT"
echo "▶︎ Mode    : $MODE"
echo "▶︎ Command : pnpm -C \"$APP_DIR\" exec expo start --dev-client -c $MODE --port $PORT"
echo

cd "$ROOT"
pnpm -C "$APP_DIR" exec expo start --dev-client -c "$MODE" --port "$PORT"
