#!/usr/bin/env bash
# tonton_sentinel_env.sh - Remet en route tout l'environnement DelishAfrica
#
# Ce script est destiné à être exécuté depuis une machine hôte où le monorepo
# DelishAfrica est installé sous /opt/delishafrica/monorepo. Il effectue les
# opérations suivantes :
#
#   1. Tue l'ancienne session tmux "DA_REL" si elle existe, pour éviter les
#      processus fantômes.
#   2. Corrige les fichiers de configuration Expo (app.config.ts/js ou app.json)
#      pour chaque app (client, merchant, courier) en y injectant le slug,
#      l'UUID projectId et le owner corrects. Cela évite les erreurs
#      "slug/projectId mismatch" lors des builds.
#   3. Vérifie et installe react-native-gesture-handler dans la racine du
#      workspace, indispensable pour les gestes et le scroll.
#   4. Relance l'installation des dépendances et nettoie les caches.
#   5. Libère les ports classiques utilisés par Expo (19000–19002) et le web
#      (3000–3001) pour éviter les conflits.
#   6. Crée une session tmux "delishafrica" avec 10 fenêtres (root, cmd,
#      api, health, ports, client, merchant, courier, platform, shell) et
#      envoie les commandes nécessaires pour démarrer chaque service.
#   7. Affiche un message final indiquant comment se connecter à la session.
#
# Lancez ce script via :
#   bash /opt/delishafrica/monorepo/scripts/tonton_sentinel_env.sh

set -euo pipefail
IFS=$'\n\t'

# Répertoire racine du monorepo
ROOT_DIR="/opt/delishafrica/monorepo"

# Informations EAS valides
OWNER="purpleorchidgroup"
CLIENT_SLUG="delishafrica-client"
CLIENT_PID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"
COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

# Vérifier la présence d'une commande
need() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Commande manquante : $1"; exit 1; }
}

need tmux
need node
need pnpm
need npx

# 1) Tuer l'ancienne session tmux DA_REL si elle existe
if tmux ls 2>/dev/null | grep -q "^DA_REL"; then
  echo "→ Suppression de la session tmux DA_REL…"
  tmux kill-session -t DA_REL || true
fi

# 2) Correction des configs Expo
fix_config() {
  local app="$1" slug="$2" pid="$3"
  local cfg=""
  if [[ -f "$ROOT_DIR/apps/$app/app.config.ts" ]]; then cfg="$ROOT_DIR/apps/$app/app.config.ts"; fi
  if [[ -f "$ROOT_DIR/apps/$app/app.config.js" ]]; then cfg="$ROOT_DIR/apps/$app/app.config.js"; fi
  if [[ -f "$ROOT_DIR/apps/$app/app.json" ]]; then cfg="$ROOT_DIR/apps/$app/app.json"; fi
  if [[ -z "$cfg" ]]; then
    echo "⚠️  Aucun fichier de configuration trouvé pour $app"
    return
  fi
  node - "$cfg" "$slug" "$pid" "$OWNER" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const SLUG  = process.argv[3];
const PID   = process.argv[4];
const OWNER = process.argv[5];
let s = fs.readFileSync(file, 'utf8');
if (file.endsWith('.json')) {
  const j = JSON.parse(s);
  j.expo = j.expo || {};
  j.expo.slug = SLUG;
  j.expo.owner = OWNER;
  j.expo.extra = j.expo.extra || {};
  j.expo.extra.eas = j.expo.extra.eas || {};
  j.expo.extra.eas.projectId = PID;
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
} else {
  function forceConst(name, value) {
    const re = new RegExp(`(^\\s*(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=)[^;]*;`, 'm');
    if (re.test(s)) {
      s = s.replace(re, `$1 "${value}";`);
    }
  }
  forceConst('SLUG', SLUG);
  forceConst('EAS_PROJECT_ID', PID);
  forceConst('OWNER', OWNER);
  s = s.replace(/(\\bslug\\s*:\\s*)(['\"`])[^'\"`]*\2/g, `$1"${SLUG}"`);
  s = s.replace(/(\\bprojectId\\s*:\\s*)(['\"`])[^'\"`]*\2/g, `$1"${PID}"`);
  s = s.replace(/(\\bowner\\s*:\\s*)(['\"`])[^'\"`]*\2/g, `$1"${OWNER}"`);
  fs.writeFileSync(file, s);
}
NODE
  echo "✅ Config corrigée : $cfg (slug=$slug, projectId=$pid)"
}

echo "→ Correction des fichiers de config Expo…"
fix_config client   "$CLIENT_SLUG"   "$CLIENT_PID"
fix_config merchant "$MERCHANT_SLUG" "$MERCHANT_PID"
fix_config courier  "$COURIER_SLUG"  "$COURIER_PID"

# 3) Installation de react-native-gesture-handler
echo "→ Vérification de react-native-gesture-handler…"
if ! pnpm list --depth 0 | grep -q "react-native-gesture-handler@"; then
  echo "react-native-gesture-handler n'est pas installé ; ajout au workspace…"
  pnpm add -w react-native-gesture-handler@latest
else
  echo "react-native-gesture-handler déjà présent."
fi

# 4) Installation des dépendances et nettoyage
echo "→ Installation des dépendances et nettoyage du cache…"
pnpm install --color=always
pnpm prune --prod || true

# 5) Libération des ports
echo "→ Libération des ports 19000–19002 et 3000–3001…"
if command -v lsof >/dev/null; then
  for p in 19000 19001 19002 3000 3001; do
    pid=$(lsof -ti tcp:"$p" || true)
    if [[ -n "$pid" ]]; then
      kill -9 "$pid" && echo "Port $p libéré (PID $pid)"
    fi
  done
else
  echo "lsof non installé ; nettoyage de ports ignoré."
fi

# 6) Démarrage de la session tmux
SESSION="delishafrica"
echo "→ Préparation de la session tmux $SESSION…"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n root -c "$ROOT_DIR"

# Création des autres fenêtres
windows=(cmd api health ports client merchant courier platform shell)
for i in "${!windows[@]}"; do
  idx=$((i+1))
  name="${windows[$i]}"
  tmux new-window -t "$SESSION:$idx" -n "$name" -c "$ROOT_DIR"
done

# 7) Commandes à exécuter dans chaque fenêtre
declare -A cmds
cmds[root]="cd $ROOT_DIR && clear"
cmds[cmd]="cd $ROOT_DIR && clear"
cmds[api]="cd $ROOT_DIR/services/api && pnpm dev"
cmds[health]="cd $ROOT_DIR/services/health && pnpm dev"
cmds[ports]="cd $ROOT_DIR/scripts && ./watch_ports.sh"
cmds[client]="cd $ROOT_DIR/apps/client && npx expo start --dev-client"
cmds[merchant]="cd $ROOT_DIR/apps/merchant && npx expo start --dev-client"
cmds[courier]="cd $ROOT_DIR/apps/courier && npx expo start --dev-client"
cmds[platform]="cd $ROOT_DIR/apps/platform && pnpm dev"
cmds[shell]="cd $ROOT_DIR && clear"

for name in "${!cmds[@]}"; do
  case "$name" in
    root)    idx="0" ;; cmd)     idx="1" ;; api)     idx="2" ;;
    health)  idx="3" ;; ports)   idx="4" ;; client)  idx="5" ;;
    merchant)idx="6" ;; courier) idx="7" ;; platform)idx="8" ;;
    shell)   idx="9" ;; *) idx="" ;;
  esac
  [[ -z "$idx" ]] && continue
  tmux send-keys -t "$SESSION:$idx" "${cmds[$name]}" C-m
done

echo "✅ Mise en route complète. Rejoignez la session via : tmux attach -t $SESSION"
