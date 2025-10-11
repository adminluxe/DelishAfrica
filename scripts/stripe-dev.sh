#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
PORT="${PORT:-4001}"

# 1) Charge .env.local si présent
if [[ -f "$ENV_FILE" ]]; then
  echo "🔧 Loading $ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
else
  echo "ℹ️ $ENV_FILE absent. Tu peux en créer un (voir README_DEV.md)."
fi

# 2) Stripe CLI écoute (optionnel)
if command -v stripe >/dev/null 2>&1; then
  echo "🔌 Stripe CLI detected. Starting listener → http://localhost:${PORT}/api/webhooks/stripe"
  pkill -f "stripe listen" 2>/dev/null || true
  # Démarre l'écoute en arrière-plan et capture la sortie 1 seconde pour récupérer le secret
  TMPLOG="$(mktemp)"
  STRIPE_WEBHOOK_SECRET_FILE="$ROOT_DIR/.stripe_webhook_secret" \
  stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,checkout.session.completed \
    --forward-to "http://localhost:${PORT}/api/webhooks/stripe" > "$TMPLOG" 2>&1 &

  sleep 2
  if grep -q "Signing secret" "$TMPLOG"; then
    SECRET=$(grep -m1 "Signing secret" "$TMPLOG" | awk '{print $NF}')
    echo "STRIPE_SIGNING_SECRET=$SECRET"
    # 3) Mets à jour .env.local (ou crée-le)
    if grep -q "^STRIPE_SIGNING_SECRET=" "$ENV_FILE" 2>/dev/null; then
      sed -i "s/^STRIPE_SIGNING_SECRET=.*/STRIPE_SIGNING_SECRET=$SECRET/" "$ENV_FILE"
    else
      echo "STRIPE_SIGNING_SECRET=$SECRET" >> "$ENV_FILE"
    fi
  else
    echo "⚠️ Impossible de capter le Signing secret (voir $TMPLOG)."
  fi
  rm -f "$TMPLOG"
else
  echo "ℹ️ Stripe CLI non installée. On continue en mode dev (webhook non signé)."
fi

# 4) Redémarre PM2 avec env mis à jour
echo "♻️ Restart API (PM2) with env from .env.local"
pm2 delete delish-api 2>/dev/null || true
pm2 start "bash -lc '\
  cd services/api && \
  set -a; [ -f ../.env.local ] && . ../.env.local || true; set +a; \
  export PORT=${PORT}; \
  pnpm exec ts-node --transpile-only src/main.ts \
'" --name delish-api
pm2 save

cat <<'TIP'

✅ Ready.

Tests utiles :

1) Créer un PaymentIntent (clé requise STRIPE_SECRET_KEY=<votre_clef_test_en_.env>) :
curl -s -X POST http://localhost:4001/api/payments/intent \
  -H 'content-type: application/json' \
  -d '{"amount": 1999, "currency": "EUR", "orderId": "11111111-1111-1111-1111-111111111111"}' | jq .

2) Simuler un webhook local (sans Stripe CLI) :
curl -s -X POST http://localhost:4001/api/webhooks/stripe \
  -H 'content-type: application/json' \
  --data-binary @stripe_samples/payment_intent_succeeded.json | jq .

3) Health :
make health

TIP
