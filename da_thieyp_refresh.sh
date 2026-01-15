#!/bin/bash
set -e

# Chemin de base
cd /opt/delishafrica/monorepo

echo "🔄 Stoppe tous les Metro/Expo..."
pkill -f "expo start" || true
pkill -f "expo-dev-server" || true
pkill -f "metro" || true
lsof -tiTCP:8081 -sTCP:LISTEN | xargs -r kill -9
lsof -tiTCP:8082 -sTCP:LISTEN | xargs -r kill -9
lsof -tiTCP:8083 -sTCP:LISTEN | xargs -r kill -9
rm -rf /tmp/metro-* /tmp/haste-map-* || true
rm -rf node_modules/.cache || true

echo "🧼 Nettoyage caches pnpm..."
pnpm store prune || true

echo "🚀 Relance apps Client / Courier / Merchant (mode tunnel)..."
tmux new-session -d -s delish
tmux rename-window -t delish 'SHELL'

tmux new-window -t delish:1 -n 'api-logs'
tmux send-keys -t delish:1 'cd /opt/delishafrica/monorepo && docker compose logs -f api' C-m

tmux new-window -t delish:2 -n 'client'
tmux send-keys -t delish:2 'cd apps/client && pnpm dev -- --tunnel --port 8081 --clear' C-m

tmux new-window -t delish:3 -n 'courier'
tmux send-keys -t delish:3 'cd apps/courier && pnpm dev -- --tunnel --port 8082 --clear' C-m

tmux new-window -t delish:4 -n 'merchant'
tmux send-keys -t delish:4 'cd apps/merchant && pnpm dev -- --tunnel --port 8083 --clear' C-m

sleep 5

echo "🧪 Test API Health..."
curl -fsS http://localhost:3010/api/v1/health && echo '✅ API UP'

echo "🌪 Injection commande test THIEYP..."
curl -X POST http://localhost:3010/api/v1/orders/demo/create \
-H 'Content-Type: application/json' \
-d '{"restaurantId":"thieyp"}'

echo "✅ Tout relancé. Swipe-close apps sur iPhone + rescan QR. Puis enchaîne :"
echo "- Client : Commander"
echo "- Merchant : Accepter + Prêt"
echo "- Courier : En mission + Terminer"
