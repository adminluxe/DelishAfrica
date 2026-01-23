#!/usr/bin/env bash
# tonton_reset_env.sh - Reset et réinitialisation de l'environnement DelishAfrica
#
# Ce script :
#   1. Force les bons slug/projectId/owner dans les fichiers app.config.* ou app.json
#      pour éviter les erreurs “slug mismatch” dans EAS.
#   2. Installe react-native-gesture-handler dans la racine du workspace.
#   3. Exécute pnpm install et nettoie les dépendances inutiles.
#   4. Coupe tous les serveurs (Expo, Node, pnpm dev) encore en cours et libère les ports 19000-19002 et 3000-3001.
#   5. Crée une session tmux “delishafrica” avec 10 fenêtres : root, cmd, api, health, ports, client, merchant, courier, platform, shell.
#      Chaque fenêtre lance automatiquement la commande associée (serveur API, Expo pour chaque app, etc.).
#
# Après exécution, attachez-vous à la session via :
#     tmux attach -t delishafrica

set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="/opt/delishafrica/monorepo"

# Valeurs EAS confirmées
OWNER="purpleorchidgroup"
CLIENT_SLUG="delishafrica-client"
CLIENT_PID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"
COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Commande manquante : $1"; exit 1; }; }
need pnpm
need node
need tmux

# Patcher un fichier de config Expo (ts/js/json)
fix_config() {
  local app="$1" slug="$2" pid="$3"
  local cfg=""
  if [[ -f "$ROOT_DIR/apps/$app/app.config.ts" ]]; then cfg="$ROOT_DIR/apps/$app/app.config.ts"; fi
  if [[ -f "$ROOT_DIR/apps/$app/app.config.js" ]]; then cfg="$ROOT_DIR/apps/$app/app.config.js"; fi
  if [[ -f "$ROOT_DIR/apps/$app/app.json" ]]; then cfg="$ROOT_DIR/apps/$app/app.json"; fi
  [[ -z "$cfg" ]] && { echo "⚠️  Aucun fichier de config trouvé pour $app"; return; }

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
    if (re.test(s)) s = s.replace(re, `$1 "${value}";`);
  }
  forceConst('SLUG', SLUG);
  forceConst('EAS_PROJECT_ID', PID);
  forceConst('OWNER', OWNER);
  s = s.replace(/(\\bslug\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${SLUG}"`);
  s = s.replace(/(\\bprojectId\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${PID}"`);
  s = s.replace(/(\\bowner\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${OWNER}"`);
  fs.writeFileSync(file, s);
}
NODE
  echo "✅ Config patchée : $cfg (slug=$slug, projectId=$pid, owner=$OWNER)"
}

echo "→ Correction des configs Expo..."
fix_config client   "$CLIENT_SLUG"   "$CLIENT_PID"
fix_config merchant "$MERCHANT_SLUG" "$MERCHANT_PID"
fix_config courier  "$COURIER_SLUG"  "$COURIER_PID"

echo "→ Installation de react-native-gesture-handler (workspace root)…"
if ! pnpm list --depth 0 | grep -q "react-native-gesture-handler@"; then
  pnpm add -w react-native-gesture-handler@latest
else
  echo "react-native-gesture-handler déjà présent."
fi

echo "→ Nettoyage & installation des dépendances…"
pnpm install --color=always
pnpm prune --prod || true

echo "→ Arrêt des serveurs Expo/Node/pnpm en cours…"
pkill -f "expo"        2>/dev/null || true
pkill -f "node .*dev"  2>/dev/null || true
pkill -f "pnpm dev"    2>/dev/null || true

echo "→ Libération des ports 19000–19002 et 3000–3001…"
if command -v lsof >/dev/null; then
  for p in 19000 19001 19002 3000 3001; do
    pid=$(lsof -ti tcp:"$p" || true)
    if [[ -n "$pid" ]]; then
      kill -9 "$pid" && echo "Port $p libéré (PID $pid)"
    fi
  done
else
  echo "lsof non disponible ; nettoyage des ports ignoré."
fi

echo "→ Création d’une session tmux propre…"
SESSION="delishafrica"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n root -c "$ROOT_DIR"

# Création des 9 autres fenêtres (0 étant root)
windows=(cmd api health ports client merchant courier platform shell)
for i in "${!windows[@]}"; do
  idx=$((i+1))
  name="${windows[$i]}"
  tmux new-window -t "$SESSION:$idx" -n "$name" -c "$ROOT_DIR"
done

# Commandes à lancer dans chaque fenêtre (à adapter selon vos répertoires/serveurs)
declare -A commands
commands[root]="cd $ROOT_DIR && clear"
commands[cmd]="cd $ROOT_DIR && clear"
commands[api]="cd $ROOT_DIR/services/api && pnpm dev"
commands[health]="cd $ROOT_DIR/services/health && pnpm dev"
commands[ports]="cd $ROOT_DIR/scripts && ./watch_ports.sh"
commands[client]="cd $ROOT_DIR/apps/client && npx expo start --dev-client"
commands[merchant]="cd $ROOT_DIR/apps/merchant && npx expo start --dev-client"
commands[courier]="cd $ROOT_DIR/apps/courier && npx expo start --dev-client"
commands[platform]="cd $ROOT_DIR/apps/platform && pnpm dev"
commands[shell]="cd $ROOT_DIR && clear"

for name in "${!commands[@]}"; do
  case "$name" in
    root)    idx="0" ;;
    cmd)     idx="1" ;;
    api)     idx="2" ;;
    health)  idx="3" ;;
    ports)   idx="4" ;;
    client)  idx="5" ;;
    merchant)idx="6" ;;
    courier) idx="7" ;;
    platform)idx="8" ;;
    shell)   idx="9" ;;
    *)       idx="" ;;
  esac
  [[ -z "$idx" ]] && continue
  tmux send-keys -t "$SESSION:$idx" "${commands[$name]}" C-m
done

echo "✅ Environnement reset terminé. Attachez-vous à la session tmux via :\n   tmux attach -t $SESSION"
