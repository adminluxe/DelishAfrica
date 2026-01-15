#!/usr/bin/env bash
set -euo pipefail
echo -e "\n📡 [DelishAfrica] Diagnostic API mobile Expo\n"

API_PORT="${API_PORT:-4001}"
API_PATH="/api/health"
API_IP_LOCAL=$(hostname -I | cut -d' ' -f1)
API_URL_LOCAL="http://${API_IP_LOCAL}:${API_PORT}${API_PATH}"

echo "🔍 1. Adresse IP locale détectée : ${API_IP_LOCAL}"
echo "     → Tester : ${API_URL_LOCAL}"
sleep 1

echo -e "\n🌐 2. Test requête locale depuis le serveur…"
curl -s --max-time 5 "${API_URL_LOCAL}" | jq . || {
  echo -e "❌ L'API ne répond pas localement. Vérifie le port/API NestJS."; exit 1; }

echo -e "\n📲 3. Tentative de ping depuis ton iPhone"
echo "     → Ouvre Safari sur le téléphone et tape :"
echo "       http://${API_IP_LOCAL}:${API_PORT}${API_PATH}"
read -p "As-tu reçu une réponse JSON sur iPhone ? (y/n) : " IOS_OK

if [[ "$IOS_OK" != "y" ]]; then
  echo -e "\n⚠️ Échec de communication directe iPhone → API."
  echo "    ➤ Vérifie :"
  echo "      - Que l’iPhone est sur le MÊME réseau Wi-Fi"
  echo "      - Que le pare-feu autorise le port $API_PORT"
  echo "      - Que NestJS écoute sur 0.0.0.0 (pas localhost)"
  echo "      - Que l’URL dans l’app utilise $API_IP_LOCAL et pas localhost"
  echo "      - Que Expo Go a bien les autorisations 'Réseau local' sur iOS"
  echo "    🛠️ Tu peux tester avec un tunnel 👇"
  read -p "Lancer tunnel HTTPS avec localtunnel ? (y/n) : " WANT_TUNNEL

  if [[ "$WANT_TUNNEL" == "y" ]]; then
    which lt &>/dev/null || npm install -g localtunnel
    echo "⛩️  Démarrage de localtunnel (port ${API_PORT})…"
    lt --port "${API_PORT}" --print-requests
  else
    echo "ℹ️  Tunnel ignoré. Résous d’abord l’accès réseau local."
  fi
  exit 1
fi

echo -e "\n✅ iPhone a bien contacté l’API locale."

echo -e "\n🛡️  4. Vérification CORS (utile si Expo Web ou frontend navigateur)"
read -p "As-tu activé app.enableCors() dans ton backend NestJS ? (y/n) : " CORS_OK
if [[ "$CORS_OK" != "y" ]]; then
  echo "⚠️  Active CORS dans main.ts de NestJS : app.enableCors();"
fi

echo -e "\n🧪 5. Vérification du fetch dans l’app mobile"
echo "     → Vérifie que l’URL dans ton code Expo pointe bien vers :"
echo "       http://${API_IP_LOCAL}:${API_PORT}"
echo "     Et que tu utilises Constants.expoConfig?.extra.API_BASE_URL si possible."

echo -e "\n🎯 Si tout est bon et que la requête échoue encore dans l’app :"
echo "     ➤ ATS peut bloquer le HTTP sur iOS."
echo "     ➤ Recommande :"
echo "         - Utiliser une URL HTTPS via tunnel (ngrok/localtunnel)"
echo "         - Ou tester en dev client Expo"

echo -e "\n🚀 Script terminé. Tu es prêt à traquer l’erreur !"
