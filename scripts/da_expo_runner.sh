#!/usr/bin/env bash
set -Eeuo pipefail

APP="${1:-}"
PORT="${2:-}"
MODE="${3:---tunnel}"

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
APPS_DIR="$ROOT/apps"

die(){ echo "[DA][ERR] $*" >&2; exit 1; }

case "$APP" in
client|merchant|courier) ;;
*) die "Usage: da_expo_runner.sh <client|merchant|courier> <port> [--tunnel|--lan]" ;;
esac

case "$PORT" in
''|*[!0-9]*) die "Port invalide: $PORT" ;;
esac

case "$MODE" in
--tunnel|--lan|--localhost) ;;
*) die "Mode invalide: $MODE ; attendu --tunnel, --lan ou --localhost" ;;
esac

DIR="$APPS_DIR/$APP"

if [[ ! -d "$DIR" ]]; then
[[ "$APP" == "courier" && -d "$APPS_DIR/coursier" ]] && DIR="$APPS_DIR/coursier"
[[ "$APP" == "merchant" && -d "$APPS_DIR/marchand" ]] && DIR="$APPS_DIR/marchand"
fi

[[ -d "$DIR" ]] || die "App dir not found for $APP in $APPS_DIR"

CACHE_BASE="${HOME}/.cache/delishafrica"
export TMPDIR="${CACHE_BASE}/tmp"
export METRO_CACHE_DIR="${CACHE_BASE}/metro"
mkdir -p "$TMPDIR" "$METRO_CACHE_DIR"

unset EXPO_NO_METRO_WORKSPACE_ROOT || true

cd "$DIR"

echo "[DA] app=$APP"
echo "[DA] dir=$DIR"
echo "[DA] port=$PORT"
echo "[DA] mode=$MODE"
echo "[DA] TMPDIR=$TMPDIR"
echo "[DA] METRO_CACHE_DIR=$METRO_CACHE_DIR"

exec pnpm exec expo start --dev-client "$MODE" --clear --port "$PORT"
