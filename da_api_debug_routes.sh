#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
API="$ROOT/services/api"

echo ">>> [DEBUG] 1) Info main.ts (prefix global, port, etc.)"
echo "----- services/api/src/main.ts (extrait) -----"
sed -n '1,220p' "$API/src/main.ts" | sed -n '1,220p'

echo
echo ">>> [DEBUG] 2) demo-orders.controller.ts (entête + méthodes)"
echo "----- services/api/src/demo-orders/demo-orders.controller.ts -----"
sed -n '1,260p' "$API/src/demo-orders/demo-orders.controller.ts" || echo "Fichier introuvable"

echo
echo ">>> [DEBUG] 3) demo-orders.module.ts (si existe)"
echo "----- services/api/src/demo-orders/demo-orders.module.ts -----"
sed -n '1,160p' "$API/src/demo-orders/demo-orders.module.ts" 2>/dev/null || echo "Fichier introuvable ou non utilisé"

echo
echo ">>> [DEBUG] 4) app.module.ts (pour vérifier l'import du module demo-orders)"
echo "----- services/api/src/app.module.ts -----"
sed -n '1,260p' "$API/src/app.module.ts" || echo "Fichier introuvable"

echo
echo ">>> [DEBUG] 5) Routes NestJS vues par l'app (si le plugin est en place)"
cd "$API"
if pnpm nest -- --version >/dev/null 2>&1; then
  echo ">> nest CLI détecté, tentative de listage des routes NestJS"
  pnpm nest -- routes || echo "Échec de 'pnpm nest -- routes' (plugin routes non dispo ?)"
else
  echo "nest CLI non détecté via pnpm, étape 5 sautée."
fi

echo
echo ">>> [DEBUG] 6) Test curl GET et POST sur /api/demo-orders (localhost:3000)"
echo ">> GET /api/demo-orders"
curl -i http://localhost:3000/api/demo-orders || true

echo
echo ">> POST /api/demo-orders (body JSON minimal)"
curl -i -X POST http://localhost:3000/api/demo-orders \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","phoneNumber":"+33102030405","items":[]}' || true

echo
echo ">>> [DEBUG] Terminé."
