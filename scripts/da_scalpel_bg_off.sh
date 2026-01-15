#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/bg_scalpel_$TS"
APPS=(client courier merchant)

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

set_env_flag() {
  local app="$1"
  local mode="${2:-off}" # off => BG_OFF=1, on => BG_OFF removed/0
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  if [[ "$mode" == "off" ]]; then
    if grep -q '^EXPO_PUBLIC_BG_OFF=' "$envfile"; then
      sed -i 's/^EXPO_PUBLIC_BG_OFF=.*/EXPO_PUBLIC_BG_OFF=1/' "$envfile"
    else
      echo "EXPO_PUBLIC_BG_OFF=1" >> "$envfile"
    fi
    log "$app: EXPO_PUBLIC_BG_OFF=1 dans $envfile"
  else
    # On ré-active: on enlève la variable (ou la met à 0 si tu préfères)
    sed -i '/^EXPO_PUBLIC_BG_OFF=/d' "$envfile" || true
    log "$app: EXPO_PUBLIC_BG_OFF supprimé (backgrounds ré-activables) dans $envfile"
  fi
}

patch_component_killswitch() {
  local f="$1"
  [[ -f "$f" ]] || return 0

  # évite double patch
  if rg -n 'DA_BG_OFF' "$f" >/dev/null 2>&1; then
    log "Déjà patché: $f"
    return 0
  fi

  backup_file "$f"
  log "Patch kill-switch: $f"

  # 1) ajoute const DA_BG_OFF après bloc imports (robuste)
  perl -0777 -i -pe '
    if ($_ !~ /DA_BG_OFF/) {
      s/\A((?:import[^\n]*\n)+)/$1\nconst DA_BG_OFF = (process.env.EXPO_PUBLIC_BG_OFF === "1" || process.env.NEXT_PUBLIC_BG_OFF === "1" || process.env.BG_OFF === "1");\n\n/s;
    }
  ' "$f"

  # 2) injecte "if (DA_BG_OFF) return null;" dans les formes les + courantes
  perl -0777 -i -pe '
    if ($_ !~ /if\s*\(\s*DA_BG_OFF\s*\)\s*return\s+null\s*;/) {
      s/(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{\s*)/$1\n  if (DA_BG_OFF) return null;\n/s
      or
      s/(export\s+function\s+\w+\s*\([^)]*\)\s*\{\s*)/$1\n  if (DA_BG_OFF) return null;\n/s
      or
      s/(function\s+\w+\s*\([^)]*\)\s*\{\s*)/$1\n  if (DA_BG_OFF) return null;\n/s
      or
      s/(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{\s*)/$1\n  if (DA_BG_OFF) return null;\n/s;
    }
  ' "$f"
}

MODE="${1:-off}" # off (désactive) / on (réactive)

log "ROOT: $ROOT"
log "BACKUP: $BK"

for app in "${APPS[@]}"; do
  [[ -d "$ROOT/apps/$app" ]] || { warn "App absente: $app"; continue; }
  set_env_flag "$app" "$MODE"

  # cible stricte : noms exacts
  while IFS= read -r f; do
    patch_component_killswitch "$f"
  done < <(find "$ROOT/apps/$app" -type f \( \
      -name "AppBackground.tsx" -o \
      -name "BrandBackground.tsx" -o \
      -name "SnowOverlay.tsx" \
    \) 2>/dev/null)
done

log "✅ OK. Backups: $BK"
log "👉 Maintenant: RESTART Expo avec --clear (sinon env pas pris)"
cat <<EOF

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

EOF
