#!/usr/bin/env bash
set -euo pipefail

# 📌 Configuration de base
BASE="http://127.0.0.1:3010"
MERCHANT_ID="merch_0001"
CUSTOMER_ID="client_0001"
COURIER_ID="courier_0001"
PRODUCT_ID="menu_0001"
ORDER_ID="order_test_001"

echo "🔍 [1/7] Vérification API..."
curl -fsS "$BASE/api/health" | jq . || { echo "❌ API injoignable"; exit 1; }

echo "🛒 [2/7] Injection de commande test..."
curl -s -X POST "$BASE/api/orders"   -H "Content-Type: application/json"   -d "{
        \"id\": \"$ORDER_ID\",
        \"merchantId\": \"$MERCHANT_ID\",
        \"customerId\": \"$CUSTOMER_ID\",
        \"items\": [ { \"id\": \"$PRODUCT_ID\", \"quantity\": 1 } ],
        \"assignCourierId\": \"$COURIER_ID\"
      }" | jq .

echo "📦 [3/7] Génération de preuve photo (base64 PNG)..."
cat >/tmp/proof.png <<'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFWAIpJr9CegAAAABJRU5ErkJggg==
EOF

echo "📤 [4/7] Upload de la preuve de livraison..."
curl -s -X POST "$BASE/api/couriers/jobs/$ORDER_ID/proof"   -F "file=@/tmp/proof.png;type=image/png" | jq .

echo "✅ [5/7] Commande visible dans l’app coursier dès maintenant."

echo "🚀 [6/7] Lancement Expo – Coursier & Client (2 terminaux recommandés)..."

# Lancer Coursier
gnome-terminal -- bash -c "cd apps/courier && pnpm dev; exec bash" 2>/dev/null ||   echo "ℹ️ Lance manuellement : cd apps/courier && pnpm dev"

# Lancer Client
gnome-terminal -- bash -c "cd apps/client && pnpm dev; exec bash" 2>/dev/null ||   echo "ℹ️ Lance manuellement : cd apps/client && pnpm dev"

echo "🎉 [7/7] Tu peux scanner les QR Codes Expo sur deux appareils (ou un seul, l’un après l’autre)."
