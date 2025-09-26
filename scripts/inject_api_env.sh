#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

# ---------- ÉDITABLE ----------
NODE_ENV_VAL="${NODE_ENV_VAL:-production}"
PORT_VAL="${PORT_VAL:-4001}"
TZ_VAL="${TZ_VAL:-Europe/Brussels}"
CORS_ORIGINS_VAL="${CORS_ORIGINS_VAL:-https://app.delishafrica.com,https://admin.delishafrica.com}"
APP_NAME="${APP_NAME:-delish-api}"
REPO_ROOT="${REPO_ROOT:-$HOME/delishafrica-monorepo}"
# --------------------------------

cd "$REPO_ROOT"

API_DIR="services/api"
ENV_FILE="$API_DIR/.env"
ECOSYS_FILE="ecosystem.delish-api.config.js"

echo "→ Upsert $ENV_FILE"
mkdir -p "$API_DIR"
touch "$ENV_FILE"
upsert() {
  local file="$1" key="$2" value="$3"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i -E "s|^${key}=.*|${key}=${value//|/\\|}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}
upsert "$ENV_FILE" NODE_ENV "$NODE_ENV_VAL"
upsert "$ENV_FILE" PORT "$PORT_VAL"
upsert "$ENV_FILE" TZ "$TZ_VAL"
upsert "$ENV_FILE" CORS_ORIGINS "$CORS_ORIGINS_VAL"
grep -E "^(NODE_ENV|PORT|TZ|CORS_ORIGINS)=" "$ENV_FILE" || true
echo

echo "→ Écrit $ECOSYS_FILE (PM2 persisté)"
cat > "$ECOSYS_FILE" <<JS
module.exports = {
  apps: [
    {
      name: '$APP_NAME',
      cwd: 'services/api',
      script: 'dist/main.js',
      watch: false,
      env: {
        NODE_ENV: '$NODE_ENV_VAL',
        PORT: $PORT_VAL,
        TZ: '$TZ_VAL',
        CORS_ORIGINS: '$CORS_ORIGINS_VAL'
      }
    }
  ]
}
JS
echo

echo "→ Build + restart PM2 avec nouvel écosystème"
pnpm -C "$API_DIR" build
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start "$ECOSYS_FILE" --only "$APP_NAME"
pm2 save
pm2 logs "$APP_NAME" --lines 10
echo

echo "→ Sanity check /api/health"
curl -sS "http://localhost:${PORT_VAL}/api/health" || true
echo
