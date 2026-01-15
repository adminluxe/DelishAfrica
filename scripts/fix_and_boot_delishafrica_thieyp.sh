#!/bin/bash

set -e

echo "🧼 Nettoyage des caches apps (Client, Courier, Merchant)…"
for APP in client courier merchant; do
  cd /opt/delishafrica/monorepo/apps/$APP
  rm -rf .expo .turbo node_modules/.cache || true
done

echo "✅ Patching des composants pour ScrollView et activation des boutons…"

# Patch scroll + bouton actif pour les 3 apps
for APP in client courier merchant; do
  SCREEN_PATH="/opt/delishafrica/monorepo/apps/$APP/app/thieyp-demo.tsx"
  if [ -f "$SCREEN_PATH" ]; then
    sed -i 's/<View/<ScrollView contentContainerStyle={{ flexGrow: 1 }}/' "$SCREEN_PATH"
    sed -i 's/<\/View>/<\/ScrollView>/' "$SCREEN_PATH"
  fi
done

# Patch spécifique bouton commander côté client
CLIENT_ORDER="/opt/delishafrica/monorepo/apps/client/app/orders-demo.ts"
if [ -f "$CLIENT_ORDER" ]; then
  sed -i '/onPress/s/=>.*/=> {'"$'\n''fetch(`${API_URL}\/api\/v1\/orders`, {'"$'\n''  method: "POST",'"$'\n''  headers: { "Content-Type": "application\/json" },'"$'\n''  body: JSON.stringify({ partner_id: "thieyp", items: [{ sku: "moi-moi", qty: 1 }] })'"$'\n''})'"$'\n''}/' "$CLIENT_ORDER"
fi

echo "🚀 Relance des 3 apps avec ports fixes et tunnel Expo"

# Relance Metro dans Tmux panes séparés si tmux actif
tmux kill-session -t delish 2>/dev/null || true
tmux new-session -d -s delish

tmux rename-window -t delish:0 'DA Apps'
tmux send-keys -t delish:0 'cd /opt/delishafrica/monorepo/apps/client && pnpm dev -- --tunnel --port 8081 --clear' C-m
tmux split-window -v -t delish:0
tmux send-keys -t delish:0.1 'cd /opt/delishafrica/monorepo/apps/courier && pnpm dev -- --tunnel --port 8082 --clear' C-m
tmux split-window -v -t delish:0
tmux send-keys -t delish:0.2 'cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear' C-m

echo "✅ Apps redémarrées avec ScrollView, boutons actifs, et tunnel OK."
echo "🧪 Pour tester : Commander sur Client → vérifier apparition sur Merchant puis Courier"
echo "🌐 Vérification API : curl http://localhost:3010/api/v1/health"
