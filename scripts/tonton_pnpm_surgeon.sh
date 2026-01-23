#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/pnpm_surgeon_$NOW"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die(){ echo -e "\n[ERROR] $*" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

log "ROOT=$ROOT"
cd "$ROOT" || die "Impossible d'entrer dans $ROOT"

need node
need npm

NODE_V="$(node -v | sed 's/^v//')"
NODE_MAJOR="$(echo "$NODE_V" | cut -d. -f1)"
log "Node: v$NODE_V (major=$NODE_MAJOR)"
log "npm:  $(npm -v 2>/dev/null || true)"
log "corepack: $(corepack --version 2>/dev/null || echo 'absent')"

# Choix version pnpm selon Node (évite incompatibilités silencieuses)
PNPM_TARGET=""
if [[ "$NODE_MAJOR" -ge 18 ]]; then
  PNPM_TARGET="9.15.4"
elif [[ "$NODE_MAJOR" -ge 16 ]]; then
  PNPM_TARGET="8.15.9"
elif [[ "$NODE_MAJOR" -ge 14 ]]; then
  PNPM_TARGET="7.33.7"
else
  PNPM_TARGET="6.35.1"
fi
log "pnpm cible: $PNPM_TARGET (adapté à Node major=$NODE_MAJOR)"

pnpm_ok(){
  pnpm -v >/dev/null 2>&1
}

# Backup configs potentiellement toxiques
for f in "$ROOT/pnpm-workspace.yaml" "$ROOT/package.json" "$ROOT/.npmrc" "$HOME/.npmrc" "$HOME/.pnpmrc"; do
  [[ -f "$f" ]] && cp -a "$f" "$BKP/" || true
done

# Force nettoyage BOM/CRLF (souvent cause de parsing chelou)
strip_bom_crlf(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  perl -pi -e 's/\x{FEFF}//g; s/\r$//g' "$f" || true
}

# 1) S'assurer que pnpm fonctionne (sinon réinstaller)
if command -v pnpm >/dev/null 2>&1; then
  log "pnpm détecté: $(command -v pnpm)"
  if pnpm_ok; then
    log "pnpm OK: $(pnpm -v)"
  else
    log "pnpm présent MAIS cassé → réinstall via npm"
    npm i -g "pnpm@$PNPM_TARGET" || die "Réinstall pnpm échouée"
  fi
else
  log "pnpm absent → install via npm"
  npm i -g "pnpm@$PNPM_TARGET" || die "Install pnpm échouée"
fi

# Re-test
pnpm -v >/dev/null 2>&1 || die "pnpm est toujours KO après réinstall"
log "pnpm final: $(pnpm -v) ($(command -v pnpm))"

# 2) Réparer/poser pnpm-workspace.yaml si nécessaire
WS="$ROOT/pnpm-workspace.yaml"
if [[ ! -f "$WS" ]]; then
  log "pnpm-workspace.yaml absent → création"
  cat > "$WS" <<'YAML'
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
YAML
else
  log "pnpm-workspace.yaml présent → vérification"
fi

strip_bom_crlf "$WS"
strip_bom_crlf "$ROOT/package.json"

# Si le workspace n’a pas de 'packages:' correct, on le reconstruit (safe)
if ! grep -qE '^[[:space:]]*packages:[[:space:]]*$' "$WS"; then
  log "workspace.yaml semble invalide (pas de 'packages:') → reconstruction SAFE"
  cp -a "$WS" "$BKP/pnpm-workspace.yaml.bad"
  cat > "$WS" <<'YAML'
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
YAML
fi

# 3) Tentative install workspace
log "pnpm -w install (workspace) à la racine"
pnpm -w install || die "pnpm -w install a échoué (voir logs ci-dessus)"

log "✅ PNPM SURGEON OK"
log "Backups: $BKP"
