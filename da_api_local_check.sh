#!/usr/bin/env bash
set -euo pipefail

BASE="http://127.0.0.1:3010"

echo ">>> Check API locale sur $BASE"

echo
echo "1) /api/health"
curl -s "$BASE/api/health" || echo "  (échec)"

echo
echo "2) /api/demo-orders"
curl -s "$BASE/api/demo-orders" || echo "  (échec)"

echo
echo "3) /api/menu/thieyp"
curl -s "$BASE/api/menu/thieyp" || echo "  (échec)"

echo
echo "4) POST /api/orders/demo"
curl -s "$BASE/api/orders/demo" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": "thieyp",
    "items": [
      { "menuItemId": "thieyp-tieboudienne", "quantity": 1 },
      { "menuItemId": "thieyp-pastels-thon", "quantity": 2 }
    ],
    "customer": {
      "name": "Client Démo",
      "phone": "+32 4 99 00 00 00",
      "address": "Rue de la Démo 10, 1000 Bruxelles",
      "notes": "Sonner à l\"interphone #42"
    },
    "meta": {
      "source": "client-ios-demo",
      "deviceId": "vps-test"
    }
  }' || echo "  (échec)"

echo
echo ">>> Check terminé."
