#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/pnpm_exorcist_$NOW"
LOG="$BKP/run.log"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
die(){ echo -e "\n[ERROR] $*" | tee -a "$LOG" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

log "ROOT=$ROOT"
cd "$ROOT" || die "Impossible d'entrer dans $ROOT"

need node
need npm
need corepack

NODE_V="$(node -v)"
NPM_V="$(npm -v || true)"
CP_V="$(corepack --version || true)"
PREFIX="$(npm config get prefix 2>/dev/null || echo /usr/local)"

log "Node: $NODE_V"
log "npm:  $NPM_V"
log "corepack: $CP_V"
log "npm prefix: $PREFIX"

snapshot_pnpm(){
  log "=== Snapshot pnpm (avant) ==="
  ( type -a pnpm || true ) | tee -a "$LOG"
  ( which -a pnpm || true ) | tee -a "$LOG"
  if command -v pnpm >/dev/null 2>&1; then
    local p; p="$(command -v pnpm)"
    log "pnpm path: $p"
    ls -la "$p" | tee -a "$LOG" || true
    file "$p" | tee -a "$LOG" || true
    head -n 30 "$p" | tee -a "$LOG" || true
    log "pnpm -v (test)"
    (pnpm -v || true) | tee -a "$LOG"
  fi
}

move_if_exists(){
  local f="$1"
  if [[ -f "$f" ]]; then
    log "Move aside: $f -> $BKP/"
    mv "$f" "$BKP/" || true
  fi
}

snapshot_pnpm

log "1) Mettre de côté configs potentiellement toxiques (.npmrc/.pnpmrc)"
move_if_exists "$ROOT/.npmrc"
move_if_exists "$HOME/.npmrc"
move_if_exists "$ROOT/.pnpmrc"
move_if_exists "$HOME/.pnpmrc"
if [[ -d "$HOME/.config/pnpm" ]]; then
  log "Move aside dir: $HOME/.config/pnpm -> $BKP/pnpm_config_dir"
  mv "$HOME/.config/pnpm" "$BKP/pnpm_config_dir" || true
fi

log "2) Test pnpm dans environnement 'propre' (sans configs)"
if command -v pnpm >/dev/null 2>&1; then
  (env -i PATH="$PATH" HOME="$HOME" SHELL="$SHELL" pnpm -v) >/dev/null 2>&1 && {
    log "✅ pnpm fonctionne en env propre -> c'était une config. On garde les configs en backup."
  } || {
    log "pnpm toujours KO même en env propre -> nuke total."
  }
else
  log "pnpm absent -> on va installer via corepack."
fi

log "3) NUKE total pnpm (bin + module + caches corepack/npm)"
# stop éventuels daemons pnpm
pkill -f "pnpm" >/dev/null 2>&1 || true

# désinstalle via npm (au cas où)
npm -g rm pnpm >/dev/null 2>&1 || true

# supprime shims
rm -f "$PREFIX/bin/pnpm" "$PREFIX/bin/pnpx" >/dev/null 2>&1 || true
rm -rf "$PREFIX/lib/node_modules/pnpm" >/dev/null 2>&1 || true

# corepack caches
rm -rf "$HOME/.cache/node/corepack" "$HOME/.local/share/corepack" >/dev/null 2>&1 || true
npm cache clean --force >/dev/null 2>&1 || true

hash -r || true

log "4) Réinstall pnpm via COREPACK (Node20) + activation"
corepack enable || true
corepack prepare pnpm@9.15.4 --activate

hash -r || true

log "5) Vérif pnpm après réinstall"
type -a pnpm | tee -a "$LOG" || true
which -a pnpm | tee -a "$LOG" || true

pnpm -v | tee -a "$LOG" || die "pnpm est toujours KO après corepack prepare"

log "✅ pnpm réparé: $(pnpm -v)"
log "Backups+log: $BKP"
