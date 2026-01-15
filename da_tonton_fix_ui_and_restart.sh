#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

PORTS_TO_FREE=(
  8081 8082 8083
  19000 19001 19002
  3000 3010 4001 4010
)

APPS=(client courier merchant)

log(){ echo -e "🧩 $*"; }
ok(){ echo -e "✅ $*"; }
warn(){ echo -e "⚠️  $*"; }
die(){ echo -e "❌ $*" >&2; exit 1; }

require_cmd(){
  command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"
}

free_port(){
  local p="$1"
  local pids=""
  pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    warn "Port $p occupé → kill: $pids"
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

kill_tmux(){
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    warn "Kill tmux session: $SESSION"
    tmux kill-session -t "$SESSION" || true
  fi
}

kill_strays(){
  warn "Kill process Expo/Metro/Node résiduels (best-effort)"
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "react-native" >/dev/null 2>&1 || true
  pkill -f "node .*expo" >/dev/null 2>&1 || true
}

ensure_workspace(){
  local ws="$ROOT/pnpm-workspace.yaml"
  [[ -f "$ws" ]] || die "pnpm-workspace.yaml introuvable: $ws"

  if ! grep -q "packages/\*" "$ws"; then
    warn "pnpm-workspace.yaml: ajout de 'packages/*'"
    # Insert under apps/* if present, else append
    if grep -q "apps/\*" "$ws"; then
      awk '
        {print}
        $0 ~ /apps\/\*/ && !done {print "  - '\''packages/*'\''"; done=1}
      ' "$ws" > "$ws.tmp" && mv "$ws.tmp" "$ws"
    else
      echo "  - 'packages/*'" >> "$ws"
    fi
  fi

  ok "Workspace OK: apps/* + packages/*"
}

ensure_ui_pkg(){
  local ui_pkg="$ROOT/packages/ui/package.json"
  [[ -f "$ui_pkg" ]] || die "Package UI introuvable: $ui_pkg"
  if ! grep -q "\"name\" *: *\"@delishafrica/ui\"" "$ui_pkg"; then
    die "packages/ui/package.json n'a pas name=@delishafrica/ui"
  fi
  ok "Package UI détecté: @delishafrica/ui"
}

ensure_app_dep(){
  local app="$1"
  local pj="$ROOT/apps/$app/package.json"
  [[ -f "$pj" ]] || die "package.json introuvable: $pj"

  if grep -q "\"@delishafrica/ui\"" "$pj"; then
    ok "apps/$app: dépendance @delishafrica/ui déjà présente"
    return
  fi

  warn "apps/$app: ajout dépendance @delishafrica/ui=workspace:*"
  node - <<NODE
const fs = require("fs");
const p = "$pj";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.dependencies = j.dependencies || {};
j.dependencies["@delishafrica/ui"] = "workspace:*";
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
NODE

  ok "apps/$app: dépendance ajoutée"
}

ensure_metro_config(){
  local app="$1"
  local mc="$ROOT/apps/$app/metro.config.js"
  if [[ -f "$mc" ]]; then
    ok "apps/$app: metro.config.js déjà présent"
    return
  fi

  warn "apps/$app: création metro.config.js (monorepo pnpm)"
  cat > "$mc" <<'JS'
const path = require("path");
const { getDefaultConfig } = require("@expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;

module.exports = config;
JS

  ok "apps/$app: metro.config.js créé"
}

restart_tmux_and_apps(){
  ok "Relance tmux + apps (si da_mux existe)"
  if [[ -x "/usr/local/bin/da_mux" ]]; then
    /usr/local/bin/da_mux
    ok "tmux relancé via /usr/local/bin/da_mux"
    return
  fi

  warn "da_mux introuvable → relance manuelle minimale dans tmux"
  tmux new-session -d -s "$SESSION" -n shell -c "$ROOT"
  tmux new-window -t "$SESSION:1" -n api-logs -c "$ROOT"
  tmux new-window -t "$SESSION:2" -n client -c "$ROOT/apps/client"
  tmux new-window -t "$SESSION:3" -n courier -c "$ROOT/apps/courier"
  tmux new-window -t "$SESSION:4" -n merchant -c "$ROOT/apps/merchant"
  tmux select-window -t "$SESSION:0"
  tmux attach -t "$SESSION"
}

main(){
  require_cmd pnpm
  require_cmd node
  require_cmd tmux
  require_cmd lsof

  [[ -d "$ROOT" ]] || die "Monorepo introuvable: $ROOT"

  log "1) Kill tmux + process résiduels"
  kill_tmux
  kill_strays

  log "2) Libération des ports (LISTEN)"
  for p in "${PORTS_TO_FREE[@]}"; do free_port "$p"; done
  ok "Ports nettoyés"

  log "3) Fix workspace + UI package"
  ensure_workspace
  ensure_ui_pkg

  log "4) Fix deps + Metro config pour chaque app"
  for a in "${APPS[@]}"; do
    ensure_app_dep "$a"
    ensure_metro_config "$a"
  done

  log "5) pnpm install (root)"
  cd "$ROOT"
  pnpm -w install

  log "6) Build UI (best-effort) puis reset caches"
  pnpm -w --filter @delishafrica/ui build || true

  ok "Fix terminé. Relance tmux/apps…"
  restart_tmux_and_apps
}

main "$@"
