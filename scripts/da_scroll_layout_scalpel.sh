#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/layout_scalpel_$TS"
LAST_LINK="$ROOT/.tonton_backups/last_layout_scalpel"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[DA ERR]\033[0m %s\n" "$*"; exit 1; }

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

restore_last() {
  [[ -L "$LAST_LINK" ]] || die "Pas de backup link: $LAST_LINK (rien à restore)."
  local SRC
  SRC="$(readlink -f "$LAST_LINK")"
  [[ -d "$SRC" ]] || die "Backup introuvable: $SRC"

  log "RESTORE depuis: $SRC"
  # On recopie la structure de backup vers ROOT (paths relatifs)
  ( cd "$SRC" && find . -type f -print0 ) | while IFS= read -r -d '' rel; do
    local src="$SRC/$rel"
    local dst="$ROOT/$rel"
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  done

  log "✅ RESTORE terminé. Relance Expo avec --clear (voir commandes en bas)."
}

set_env_flags() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  # LAYOUT scalpel ON + diag ON + BG OFF conservé (au cas où)
  grep -q '^EXPO_PUBLIC_LAYOUT_SCALPEL=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_LAYOUT_SCALPEL=.*/EXPO_PUBLIC_LAYOUT_SCALPEL=1/' "$envfile" \
    || echo "EXPO_PUBLIC_LAYOUT_SCALPEL=1" >> "$envfile"

  grep -q '^EXPO_PUBLIC_SCROLL_DIAG=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_SCROLL_DIAG=.*/EXPO_PUBLIC_SCROLL_DIAG=1/' "$envfile" \
    || echo "EXPO_PUBLIC_SCROLL_DIAG=1" >> "$envfile"

  grep -q '^EXPO_PUBLIC_BG_OFF=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_BG_OFF=.*/EXPO_PUBLIC_BG_OFF=1/' "$envfile" \
    || echo "EXPO_PUBLIC_BG_OFF=1" >> "$envfile"

  log "$app: .env.local => LAYOUT_SCALPEL=1 + SCROLL_DIAG=1 + BG_OFF=1"
}

write_safe_layout() {
  local f="$1"
  backup_file "$f"
  log "overwrite SAFE _layout -> $f"

  cat > "$f" <<'TSX'
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Slot } from "expo-router";

/**
 * LAYOUT SCALPEL
 * Objectif: éliminer TOUS les wrappers au root (GestureDetector, providers, overlays)
 * pour vérifier si un layout capte les gestes (scroll KO).
 *
 * Indication visuelle: badge "LAYOUT SCALPEL" (pointerEvents none).
 */
export default function Layout() {
  const ON = process.env.EXPO_PUBLIC_LAYOUT_SCALPEL === "1";

  return (
    <View style={styles.root} pointerEvents="box-none">
      {ON && (
        <View pointerEvents="none" style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LAYOUT SCALPEL</Text>
          </View>
        </View>
      )}
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  badgeWrap: { position: "absolute", top: 12, left: 12, zIndex: 9999 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  badgeText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "700" },
});
TSX
}

kill_ports() {
  local ports=(8081 8082 8083 19000 19001 19002 19006 19007 4040 4049)
  for p in "${ports[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      log "Kill port $p"
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
  pkill -f "expo start" || true
  pkill -f "expo-dev-server" || true
  pkill -f "metro" || true
  pkill -f "ngrok" || true
  pkill -f "@expo/ngrok" || true
}

MODE="${1:-apply}"

if [[ "$MODE" == "restore" ]]; then
  restore_last
  cat <<EOF

👉 Relance Expo (dans tmux) :

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083
EOF
  exit 0
fi

log "ROOT: $ROOT"
mkdir -p "$BK"
ln -sfn "$BK" "$LAST_LINK"
log "BACKUP: $BK"
log "LAST LINK: $LAST_LINK"

kill_ports

for app in "${APPS[@]}"; do
  local_base="$ROOT/apps/$app"
  if [[ ! -d "$local_base" ]]; then
    warn "App absente: $app"
    continue
  fi

  set_env_flags "$app"

  local appdir="$local_base/app"
  if [[ ! -d "$appdir" ]]; then
    warn "$app: dossier app/ introuvable -> skip"
    continue
  fi

  # Patch TOUS les _layout.tsx (root + nested)
  mapfile -t layouts < <(find "$appdir" -type f -name "_layout.tsx" 2>/dev/null || true)
  if [[ "${#layouts[@]}" -eq 0 ]]; then
    warn "$app: aucun _layout.tsx trouvé"
    continue
  fi

  log "$app: patch ${#layouts[@]} layout(s)"
  for f in "${layouts[@]}"; do
    write_safe_layout "$f"
  done
done

log "✅ Layout scalpel appliqué."
log "👉 Relance Expo avec --clear (env + cache), puis swipe-close complet sur iPhone + re-scan QR."

cat <<EOF

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Backups: $BK
Restore rapide:
bash $ROOT/scripts/da_scroll_layout_scalpel.sh restore
EOF
