#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://127.0.0.1:3010}"
MERCHANT_ID="${MERCHANT_ID:-merch_0001}"

# ─────────────────────────────────────────────────────────────
# (1) Démarrer API
echo "[A] Lancement API NestJS (PM2)"
pm2 delete delish-api 2>/dev/null || true
pm2 start "bash -lc 'cd services/api && set -a; . prisma/.env; set +a; PORT=4001 pnpm exec ts-node --transpile-only src/main.ts'" --name delish-api
pm2 save

# ─────────────────────────────────────────────────────────────
# (2) Test de connectivité via script auto
echo -e "\n[B] Diagnostic réseau (API vs mobile)"
SCRIPT_PATH="./apps/client/da-debug-api-connectivity.sh"
if [ ! -x "$SCRIPT_PATH" ]; then
  echo "❌ Script $SCRIPT_PATH manquant ou non exécutable."
  exit 1
fi

$SCRIPT_PATH || {
  echo "⛔ Diagnostic échoué : l’API n’est pas accessible depuis ton iPhone."
  echo "💡 Corrige les erreurs affichées ci-dessus puis relance : ./dev-all.sh"
  exit 1
}

# ─────────────────────────────────────────────────────────────
# (3) Démarrer les apps Expo (client / courier / merchant)
echo -e "\n[C] Démarrage apps Expo (mode tunnel, ports dédiés)"
PORTS=( [client]=19001 [courier]=19002 [merchant]=19003 )

start_expo() {
  local A="$1"
  local P="${PORTS[$A]}"
  if [ -d "apps/$A" ]; then
    echo "→ $A : port $P"
    ( cd apps/$A \
      && jq ".expo.extra.API_BASE_URL = \"${API_URL}\" | .expo.extra.MERCHANT_ID = \"${MERCHANT_ID}\"" app.json > app.tmp && mv app.tmp app.json \
      && pnpm install \
      && npx expo start --port "$P" --tunnel --non-interactive >> "../../expo-${A}.log" 2>&1 ) &
  fi
}

start_expo client
start_expo courier
start_expo merchant

sleep 4
echo -e "\n✅ Tout lancé. Pour voir les QR :"
echo "  tail -f expo-client.log"
echo "  tail -f expo-courier.log"
echo "  tail -f expo-merchant.log"
wait
