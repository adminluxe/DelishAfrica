#!/usr/bin/env bash
# tonton_sentinel_env_v2.sh - Réinitialisation robuste de l'environnement DelishAfrica
#
# Cette version du script "sentinelle" est conçue pour éviter les problèmes de
# conflit PNPM (notamment l'erreur `ERR_PNPM_INCLUDED_DEPS_CONFLICT`) qui
# apparaissent lorsque les dépendances ont été installées avec un jeu de
# catégories différent (dependencies, devDependencies, optionalDependencies)
# lors de l'exécution précédente.  Pour y parvenir, ce script supprime
# complètement le dossier node_modules et réinstalle toutes les dépendances
# (prod, dev et optional) en mode --force.  Il vérifie également la présence
# des configurations Expo, installe react-native-gesture-handler si nécessaire,
# libère les ports et recrée une session tmux structurée.
#
# Utilisation : exécuter ce script depuis n'importe quel terminal :
#    bash /opt/delishafrica/monorepo/scripts/tonton_sentinel_env_v2.sh

set -euo pipefail
IFS=$'\n\t'

# Répertoire racine du monorepo
ROOT_DIR="/opt/delishafrica/monorepo"

# Informations EAS valides (slug + projectId + owner)
OWNER="purpleorchidgroup"
CLIENT_SLUG="delishafrica-client"
CLIENT_PID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"
COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

# Vérifie si une commande est disponible, sinon affiche un message d'erreur
need() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Commande manquante : $1"; exit 1; }
}

need tmux
need node
need pnpm
need npx

# 1) Tuer l'ancienne session tmux "DA_REL" si elle existe
if tmux ls 2>/dev/null | grep -q "^DA_REL"; then
  echo "→ Suppression de la session tmux DA_REL…"
  tmux kill-session -t DA_REL || true
fi

# 2) Correction des fichiers de configuration Expo
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
  s = s.replace(/(\\bslug\\s*:\\s*)(['"`])[^'"`]*\2/g, `$1"${SLUG}"`);
  s = s.replace(/(\\bprojectId\\s*:\\s*)(['"`])[^'"`]*\2/g, `$1"${PID}"`);
  s = s.replace(/(\\bowner\\s*:\\s*)(['"`])[^'"`]*\2/g, `$1"${OWNER}"`);
  fs.writeFileSync(file, s);
}
NODE
  echo "✅ Config corrigée : $cfg (slug=$slug, projectId=$pid)"
}

echo "→ Correction des fichiers de config Expo…"
fix_config client   "$CLIENT_SLUG"   "$CLIENT_PID"
fix_config merchant "$MERCHANT_SLUG" "$MERCHANT_PID"
fix_config courier  "$COURIER_SLUG"  "$COURIER_PID"

# 3) Vérification/installation de react-native-gesture-handler
echo "→ Vérification de react-native-gesture-handler…"
if ! pnpm list --depth 0 2>/dev/null | grep -q "react-native-gesture-handler@"; then
  echo "react-native-gesture-handler n'est pas installé ; ajout au workspace…"
  pnpm add -w react-native-gesture-handler@latest
else
  echo "react-native-gesture-handler déjà présent."
fi

# 4) Réinstallation des dépendances avec suppression du node_modules
echo "→ Suppression du répertoire node_modules pour éviter les conflits…"
rm -rf "$ROOT_DIR/node_modules"
echo "→ Réinstallation de toutes les dépendances (prod/dev/optional) en mode --force…"
# On force l'inclusion de toutes les catégories (prod, dev, optional)
# La variable PNPM_INCLUDED_DEPS est reconnue par pnpm >=7 pour définir les types de dépendances à installer
PNPM_INCLUDED_DEPS="prod,dev,optional" pnpm install --color=always --force || {
  echo "⚠️  pnpm install a échoué, nouvelle tentative avec l'option --include=optional";
  pnpm install --color=always --force --include optional || true
}
# Nettoyage des dépendances de production inutiles après installation
pnpm prune --prod || true

# 5) Libération des ports courants (Expo et serveur web)
echo "→ Libération des ports 19000–19002 et 3000–3001…"
if command -v lsof >/dev/null; then
  for p in 19000 19001 19002 3000 3001; do
    pid=$(lsof -ti tcp:"$p" || true)
    if [[ -n "$pid" ]]; then
      kill -9 "$pid" && echo "Port $p libéré (PID $pid)"
    fi
  done
else
  echo "lsof n'est pas installé ; nettoyage des ports ignoré."
fi

# 6) Création de la session tmux "delishafrica" et de ses fenêtres
SESSION="delishafrica"
echo "→ Préparation de la session tmux $SESSION…"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n root -c "$ROOT_DIR"

# Liste des fenêtres supplémentaires (hors root)
windows=(cmd api health ports client merchant courier platform shell)
for i in "${!windows[@]}"; do
  idx=$((i+1))
  name="${windows[$i]}"
  tmux new-window -t "$SESSION:$idx" -n "$name" -c "$ROOT_DIR"

done

# Commandes à envoyer automatiquement dans chaque fenêtre
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

# Mappage index de fenêtres tmux
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

echo "✅ Environnement réinitialisé avec succès. Pour attacher la session :"
echo "   tmux attach -t $SESSION"

