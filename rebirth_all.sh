#!/bin/bash

echo ">> Arrêt des processus Expo/Metro/Node en conflit..."
# Terminer toute instance Expo CLI / Metro bundler des apps mobile
pkill -f "expo start"     || true
pkill -f "expo-dev-server"  || true
pkill -f "metro"            || true

# Terminer d'éventuels tunnels Cloudflare actifs
pkill -f cloudflared     || true

# Libérer les ports Metro 8081/8082/8083 (et ports voisins si utilisés)
for PORT in 8081 8082 8083 8084 8085 8086 19000 19001; do
  lsof -tiTCP:$PORT -sTCP:LISTEN | xargs -r kill -9
done

# Libérer le port API 3010 s'il était occupé
lsof -tiTCP:3010 -sTCP:LISTEN | xargs -r kill -9

# Vérification que le port 3010 est bien libéré
if lsof -iTCP:3010 -sTCP:LISTEN; then
  echo "!! Le port 3010 est toujours occupé, échec de la libération. Abandon."
  exit 1
else
  echo ">> Port 3010 libéré avec succès."
fi

echo ">> (Re)Démarrage de l'API NestJS sur le port 3010..."
cd /opt/delishafrica/monorepo  # chemin du monorepo source de vérité
# Lancement de l'API (exemple avec pnpm, adapter si nécessaire au projet)
pnpm --filter api-nest start &

# Attendre quelques secondes que l'API démarre
sleep 5

# Vérifier l'endpoint /api/health en local
HEALTH=$(curl -fsS http://127.0.0.1:3010/api/health || echo "down")
if [[ "$HEALTH" == *'"status":"ok"'* ]]; then 
  echo ">> API démarrée avec succès (health OK)."
else 
  echo "!! L'API ne répond pas correctement sur /api/health. Révisez les logs."
  echo "Réponse actuelle : $HEALTH"
fi
