#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"
APPS=(client courier merchant)

log(){ echo -e "🧠 $*"; }
ok(){ echo -e "✅ $*"; }
warn(){ echo -e "⚠️  $*"; }

need(){ [ -e "$1" ] || { echo "❌ Missing: $1" >&2; exit 1; }; }

free_port(){
  local p="$1"
  local pids
  pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids:-}" ]; then
    warn "Kill port $p -> $pids"
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

kill_tmux(){
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
}

ensure_dep(){
  local pkg="$1"
  local name="$2"
  local version="$3"

  node - <<NODE
const fs = require("fs");
const p = "$pkg";
const j = JSON.parse(fs.readFileSync(p,"utf8"));
j.dependencies ||= {};
j.dependencies["$name"] = j.dependencies["$name"] || "$version";
fs.writeFileSync(p, JSON.stringify(j,null,2) + "\n");
console.log("OK dep:", "$name", "->", "$version", "in", p);
NODE
}

write_metro(){
  local app="$1"
  local f="$ROOT/apps/$app/metro.config.js"
  cat > "$f" <<'JS'
const path = require("path");
const { getDefaultConfig } = require("@expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// monorepo: watch the whole workspace
config.watchFolders = [workspaceRoot];

// pnpm: make Metro resolve deps from both app + workspace
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// IMPORTANT: do NOT disable hierarchical lookup here; it can break Metro internals (metro-runtime)
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
JS
  ok "metro.config.js écrit pour $app"
}

main(){
  need "$ROOT"
  need "$ROOT/pnpm-workspace.yaml"
  need "$ROOT/packages/ui/package.json"

  log "1) Kill tmux + kill Expo/Metro + libérer ports"
  kill_tmux
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true

  for p in 8081 8082 8083 19000 19001 19002; do free_port "$p"; done
  ok "Ports libérés"

  log "2) Vérifier que le package UI a bien le bon name"
  if ! grep -q "\"name\" *: *\"@delishafrica/ui\"" "$ROOT/packages/ui/package.json"; then
    echo "❌ packages/ui/package.json doit contenir: \"name\": \"@delishafrica/ui\"" >&2
    exit 1
  fi
  ok "UI package name OK"

  log "3) Installer metro-runtime au root (corrige l’erreur HMRClient)"
  cd "$ROOT"
  pnpm -w add metro-runtime

  log "4) Assurer les deps @delishafrica/ui + @expo/metro-config dans chaque app"
  for a in "${APPS[@]}"; do
    ensure_dep "$ROOT/apps/$a/package.json" "@delishafrica/ui" "workspace:*"
    ensure_dep "$ROOT/apps/$a/package.json" "@expo/metro-config" "^0.19.0"
  done

  log "5) Réécrire metro.config.js (version safe pnpm/monorepo)"
  for a in "${APPS[@]}"; do
    write_metro "$a"
  done

  log "6) pnpm install (root) + cache reset"
  pnpm -w install

  ok "Fix terminé ✅"
  echo
  echo "🚀 Maintenant relance tes 3 apps avec cache reset:"
  echo "  - client  : (dans apps/client)  pnpm dev  (ou expo start --dev-client -c --tunnel --port 8081)"
  echo "  - courier : (dans apps/courier) pnpm dev  (ou ... --port 8082)"
  echo "  - merchant: (dans apps/merchant)pnpm dev  (ou ... --port 8083)"
}

main
