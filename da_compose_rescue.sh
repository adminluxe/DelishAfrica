#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

echo "== DelishAfrica | Compose Rescue =="
echo "ROOT=$ROOT"
date
echo

echo "== 1) Recherche des fichiers compose =="
mapfile -t FOUND < <(
  find "$ROOT" -maxdepth 5 -type f \
    \( -iname "docker-compose.yml" -o -iname "docker-compose.yaml" -o -iname "compose.yml" -o -iname "compose.yaml" \) \
    -print
)

if [ "${#FOUND[@]}" -eq 0 ]; then
  echo "❌ Aucun fichier compose trouvé dans $ROOT (maxdepth 5)."
  echo "   => soit le compose a été supprimé, soit il est plus profond que 5 niveaux."
  echo "   Relance avec maxdepth 12 manuellement :"
  echo "   find $ROOT -maxdepth 12 -type f \\( -iname 'docker-compose*.y*ml' -o -iname 'compose.y*ml' \\) -print"
  exit 1
fi

echo "✅ Fichiers compose trouvés :"
for f in "${FOUND[@]}"; do
  echo " - $f"
done
echo

echo "== 2) Choix automatique (le plus 'récent') =="
# On prend le fichier le plus récent (mtime)
CHOSEN="$(ls -t "${FOUND[@]}" | head -n 1)"
echo "👉 Choisi: $CHOSEN"
echo

echo "== 3) Mise en place à la racine =="
TARGET="$ROOT/docker-compose.yml"
if [ -f "$TARGET" ]; then
  BK="$ROOT/docker-compose.yml.bak.$(date +%Y%m%d_%H%M%S)"
  echo "⚠️ docker-compose.yml existe déjà, backup => $BK"
  cp -a "$TARGET" "$BK"
fi

# Copie (plus safe qu'un symlink dans un contexte serveur)
cp -a "$CHOSEN" "$TARGET"
echo "✅ Copié => $TARGET"
echo

echo "== 4) Validation Compose =="
docker compose -f "$TARGET" config >/dev/null
echo "✅ docker compose config OK"
echo

echo "== 5) Restart clean docker compose =="
docker compose -f "$TARGET" down --remove-orphans || true
docker compose -f "$TARGET" up -d --build
docker compose -f "$TARGET" ps
echo

echo "== 6) Healthchecks locaux (ports 4001 / 3010) =="
set +e
curl -i --max-time 3 http://127.0.0.1:4001/api/health
echo
curl -i --max-time 3 http://127.0.0.1:3010/api/health
echo
set -e

echo "== 7) Cloudflared (si présent) =="
if [ -f /root/.cloudflared/config.yml ]; then
  echo "--- /root/.cloudflared/config.yml (extrait) ---"
  sed -n '1,140p' /root/.cloudflared/config.yml
  echo "---------------------------------------------"
  systemctl restart cloudflared || true
  systemctl status cloudflared --no-pager -l || true
fi

echo
echo "== 8) Healthcheck public =="
set +e
curl -i --max-time 8 https://api.delishafrica.me/api/health
echo
set -e

echo "✅ DONE."
