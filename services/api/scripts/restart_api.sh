# /home/tontoncestcarre/delishafrica-monorepo/services/api/scripts/restart_api.sh
#!/usr/bin/env bash

# --- Re-exec en bash si lancé via sh/dash ---
if [ -z "${BASH_VERSION:-}" ]; then
  exec /bin/bash "$0" "$@"
fi

set -Eeuo pipefail

# Defaults
TIMEOUT=90
PORT="${PORT:-4001}"
APP_NAME="delish-api"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ECO="${ROOT}/ecosystem.config.js"

# Args: --timeout/-t, --port/-p
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--timeout) TIMEOUT="${2:-$TIMEOUT}"; shift 2 ;;
    -p|--port)    PORT="${2:-$PORT}";       shift 2 ;;
    *)            shift ;;
  esac
done

echo "→ Restart $APP_NAME via PM2…"
pm2 start "$ECO" --only "$APP_NAME" >/dev/null 2>&1 || true
pm2 reload "$ECO" --only "$APP_NAME" || pm2 restart "$APP_NAME"

echo "→ Healthcheck http://localhost:${PORT}/api/health (timeout ${TIMEOUT}s)…"
deadline=$((SECONDS+TIMEOUT))
until curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; do
  if (( SECONDS > deadline )); then
    echo "✖ Healthcheck échoué après ${TIMEOUT}s. Derniers logs PM2 :"
    pm2 logs "$APP_NAME" --lines 80
    exit 1
  fi
  sleep 0.5
done
echo "✓ API OK."
