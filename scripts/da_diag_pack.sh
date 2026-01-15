#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
if [ ! -d "$ROOT" ]; then
  echo "ERROR: monorepo not found at $ROOT"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
OUTDIR="$ROOT/_diag/$TS"
mkdir -p "$OUTDIR"

log() { echo "==> $*" | tee -a "$OUTDIR/_run.log"; }

log "Collecting environment info"
{
  echo "DATE: $(date -Is)"
  echo "HOST: $(hostname)"
  echo "PWD:  $(pwd)"
  echo
  echo "NODE: $(node -v 2>/dev/null || echo 'N/A')"
  echo "NPM:  $(npm -v 2>/dev/null || echo 'N/A')"
  echo "PNPM: $(pnpm -v 2>/dev/null || echo 'N/A')"
  echo "YARN: $(yarn -v 2>/dev/null || echo 'N/A')"
  echo
  echo "DOCKER: $(docker --version 2>/dev/null || echo 'N/A')"
  echo "DOCKER COMPOSE: $(docker compose version 2>/dev/null || echo 'N/A')"
  echo
  echo "GIT: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
  echo "GIT STATUS:"
  git -C "$ROOT" status -sb 2>/dev/null || true
} >"$OUTDIR/env.txt" 2>&1

log "Collecting tmux state (if any)"
{
  tmux ls 2>/dev/null || true
  echo
  tmux list-windows -a 2>/dev/null || true
  echo
  tmux list-panes -a -F '#S:#I.#P #{pane_current_command} #{pane_title} #{pane_active}' 2>/dev/null || true
} >"$OUTDIR/tmux.txt" 2>&1

log "Collecting ports/processes"
{
  echo "SS LISTEN (important ports):"
  ss -lntp | egrep ':(3010|4001|8081|8082|8083|19000|19001|19002|19006|8088)\b' || true
  echo
  echo "Top node/expo/metro processes:"
  ps aux | egrep 'node|expo|metro|react-native|nest' | egrep -v 'egrep|grep' || true
} >"$OUTDIR/runtime_ports_processes.txt" 2>&1

log "Tree snapshot (limited depth) + raw find listing"
# tree can be missing; we do best-effort.
{
  cd "$ROOT"
  if command -v tree >/dev/null 2>&1; then
    tree -a -L 6 -I 'node_modules|.git|dist|build|.expo|.next|.turbo|coverage|.cache' .
  else
    echo "tree not installed; using find summary instead"
    find . -maxdepth 6 -type d -print | sed 's#^\./##' | sort
  fi
} >"$OUTDIR/tree_L6.txt" 2>&1

# This can be large, but we compress anyway.
( cd "$ROOT" && find . -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.expo/*' \
  -not -path '*/.next/*' \
  -not -path '*/coverage/*' \
  -not -path '*/.cache/*' \
  -printf '%p\n' | sed 's#^\./##' | sort \
) >"$OUTDIR/find_files.txt" 2>&1 || true

log "Locate router/layout files & expo-router usage"
{
  cd "$ROOT"
  echo "=== LAYOUT FILES (client/merchant/courier) ==="
  find apps -maxdepth 6 -type f \( -iname '_layout.*' -o -iname 'layout.*' \) 2>/dev/null | sort || true
  echo
  echo "=== ROUTES INDEX FILES ==="
  find apps -maxdepth 8 -type f \( -iname 'index.*' -o -iname '+not-found.*' -o -iname 'not-found.*' \) 2>/dev/null | sort || true
  echo
  echo "=== EXPO-ROUTER REFERENCES (top hits) ==="
  rg -n --hidden --no-ignore -S "expo-router" apps services 2>/dev/null | head -n 200 || true
  echo
  echo "=== Stack.Screen name=... occurrences ==="
  rg -n --hidden --no-ignore -S "Stack\.Screen" apps 2>/dev/null | head -n 200 || true
} >"$OUTDIR/router_layout_scan.txt" 2>&1

log "Copy key config files (safe subset)"
mkdir -p "$OUTDIR/keyfiles"
copy_if() { [ -f "$1" ] && cp -a "$1" "$OUTDIR/keyfiles/" || true; }

copy_if "$ROOT/package.json"
copy_if "$ROOT/pnpm-workspace.yaml"
copy_if "$ROOT/turbo.json"
copy_if "$ROOT/docker-compose.yml"
copy_if "$ROOT/.env"
copy_if "$ROOT/.env.development"
copy_if "$ROOT/.env.production"

for a in client merchant courier; do
  copy_if "$ROOT/apps/$a/package.json"
  copy_if "$ROOT/apps/$a/app.json"
  copy_if "$ROOT/apps/$a/app.config.js"
  copy_if "$ROOT/apps/$a/app.config.ts"
  copy_if "$ROOT/apps/$a/.env"
  copy_if "$ROOT/apps/$a/.env.development"
  copy_if "$ROOT/apps/$a/.env.production"
  # layout files (best effort)
  find "$ROOT/apps/$a" -maxdepth 6 -type f -iname '_layout.*' -exec cp -a {} "$OUTDIR/keyfiles/" \; 2>/dev/null || true
done

log "Create compressed archive"
ARCHIVE="$ROOT/_diag/DA_DIAG_${TS}.tar.gz"
tar -C "$ROOT/_diag" -czf "$ARCHIVE" "$TS"

log "DONE"
echo
echo "✅ DIAG ARCHIVE: $ARCHIVE"
echo "To inspect quickly: tar -tzf $ARCHIVE | head"
