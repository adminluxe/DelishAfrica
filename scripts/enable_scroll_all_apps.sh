#!/bin/bash

set -e

echo "🧼 Patch automatique ScrollView – DelishAfrica Apps"

# Liste des apps
APPS=(client courier merchant)

# Liste des fichiers à patcher par app (adapter selon structure)
FILES=(thieyp-demo.tsx orders-demo.tsx missions.tsx)

for APP in "${APPS[@]}"; do
  echo "🔧 App: $APP"
  APP_PATH="/opt/delishafrica/monorepo/apps/$APP/app"

  for FILE in "${FILES[@]}"; do
    FILE_PATH="$APP_PATH/$FILE"
    if [ -f "$FILE_PATH" ]; then
      echo "➡️  Patch de: $FILE_PATH"

      # Ajouter l'import ScrollView si pas encore présent
      grep -q 'ScrollView' "$FILE_PATH" || sed -i '1s/^/import { ScrollView } from "react-native";\'$'\n/' "$FILE_PATH"

      # Remplacer <View ...> racine par <ScrollView ...>
      sed -i '0,/<View/{s/<View[^>]*/<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}/}' "$FILE_PATH"
      sed -i '0,/<\/View>/{s/<\/View>/<\/ScrollView>/}' "$FILE_PATH"
    fi
  done
done

echo "✅ Scroll activé dans les écrans ciblés"

echo "🔁 Redémarrage Metro servers avec clear-cache & ports fixés"
tmux kill-session -t delish 2>/dev/null || true
tmux new-session -d -s delish

tmux rename-window -t delish:0 'DA Live'
tmux send-keys -t delish:0 'cd /opt/delishafrica/monorepo/apps/client && pnpm dev -- --tunnel --port 8081 --clear' C-m
tmux split-window -v -t delish:0
tmux send-keys -t delish:0.1 'cd /opt/delishafrica/monorepo/apps/courier && pnpm dev -- --tunnel --port 8082 --clear' C-m
tmux split-window -v -t delish:0
tmux send-keys -t delish:0.2 'cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear' C-m

echo "🚀 Tout est relancé avec ScrollView injecté. Vérifie Client + Courier."
