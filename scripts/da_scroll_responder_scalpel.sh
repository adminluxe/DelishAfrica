#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/responder_scalpel_$TS"
LAST_LINK="$ROOT/.tonton_backups/last_responder_scalpel"
REPORT_DIR="$ROOT/.tonton_backups/_reports"
REPORT="$REPORT_DIR/scroll_suspects_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[DA ERR]\033[0m %s\n" "$*"; exit 1; }

mkdir -p "$BK" "$REPORT_DIR"

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
  ( cd "$SRC" && find . -type f -print0 ) | while IFS= read -r -d '' rel; do
    local src="$SRC/$rel"
    local dst="$ROOT/$rel"
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  done

  log "✅ RESTORE terminé."
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

set_env_flags() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  # On garde BG_OFF/DIAG si déjà, + ajoute RESPONDER_SCALPEL
  grep -q '^EXPO_PUBLIC_BG_OFF=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_BG_OFF=.*/EXPO_PUBLIC_BG_OFF=1/' "$envfile" \
    || echo "EXPO_PUBLIC_BG_OFF=1" >> "$envfile"

  grep -q '^EXPO_PUBLIC_SCROLL_DIAG=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_SCROLL_DIAG=.*/EXPO_PUBLIC_SCROLL_DIAG=1/' "$envfile" \
    || echo "EXPO_PUBLIC_SCROLL_DIAG=1" >> "$envfile"

  grep -q '^EXPO_PUBLIC_RESPONDER_SCALPEL=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_RESPONDER_SCALPEL=.*/EXPO_PUBLIC_RESPONDER_SCALPEL=1/' "$envfile" \
    || echo "EXPO_PUBLIC_RESPONDER_SCALPEL=1" >> "$envfile"

  log "$app: .env.local => BG_OFF=1 + SCROLL_DIAG=1 + RESPONDER_SCALPEL=1"
}

find_app_dir() {
  local base="$1"
  # cherche un dossier "app" plausible (Expo Router)
  local found
  found="$(find "$base" -maxdepth 5 -type d -name "app" 2>/dev/null | head -n 1 || true)"
  [[ -n "$found" ]] && { echo "$found"; return 0; }
  echo ""
}

write_probe_screen() {
  local f="$1"
  backup_file "$f"
  log "overwrite PROBE screen -> $f"

  cat > "$f" <<'TSX'
import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";

export default function ScrollProbe() {
  // Pure RN ScrollView (no reanimated / no wrappers)
  const items = Array.from({ length: 120 }).map((_, i) => i + 1);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View pointerEvents="none" style={styles.badgeWrap}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SCROLL PROBE (RESPONDER)</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>If this scrolls ✅</Text>
        <Text style={styles.p}>
          Alors le bloqueur est dans l’écran original (TouchableWithoutFeedback / Pressable full-flex / GestureDetector / responder props).
        </Text>

        {items.map((n) => (
          <View key={String(n)} style={styles.row}>
            <Text style={styles.rowText}>Row {n}</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
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
  badgeText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "800" },
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  h1: { fontSize: 18, fontWeight: "800", marginBottom: 6, color: "white" },
  p: { fontSize: 13, opacity: 0.9, color: "white", marginBottom: 10 },
  row: { height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", paddingHorizontal: 12 },
  rowText: { color: "rgba(255,255,255,0.92)", fontWeight: "600" },
});
TSX
}

patch_entry_routes() {
  local app="$1"
  local base="$ROOT/apps/$app"
  local appdir
  appdir="$(find_app_dir "$base")"

  if [[ -z "$appdir" ]]; then
    warn "$app: dossier app/ introuvable -> skip patch routes"
    return 0
  fi

  log "$app: appdir=$appdir"

  # candidates prioritaires
  local candidates=(
    "$appdir/index.tsx"
    "$appdir/(tabs)/index.tsx"
    "$appdir/(home)/index.tsx"
    "$appdir/home/index.tsx"
    "$appdir/(root)/index.tsx"
  )

  local patched=0
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      write_probe_screen "$f"
      patched=$((patched+1))
    fi
  done

  # fallback: patch 1..3 index.tsx maxdepth 3 si rien trouvé
  if [[ "$patched" -eq 0 ]]; then
    warn "$app: aucun index.tsx standard trouvé -> fallback find"
    mapfile -t idxs < <(find "$appdir" -maxdepth 3 -type f -name "index.tsx" 2>/dev/null | head -n 3 || true)
    for f in "${idxs[@]}"; do
      [[ -f "$f" ]] || continue
      write_probe_screen "$f"
      patched=$((patched+1))
    done
  fi

  if [[ "$patched" -eq 0 ]]; then
    warn "$app: aucun index.tsx patché (structure atypique)"
  else
    log "$app: patched $patched entry route(s)"
  fi
}

scan_suspects() {
  local app="$1"
  local base="$ROOT/apps/$app"
  [[ -d "$base" ]] || return 0

  {
    echo ""
    echo "=============================="
    echo "APP: $app"
    echo "BASE: $base"
    echo "DATE: $(date)"
    echo "=============================="
    echo ""
    echo ">>> Suspects keywords:"
    echo "TouchableWithoutFeedback | onStartShouldSetResponder | onMoveShouldSetResponder | GestureDetector | PanGestureHandler | Gesture.Pan | Pressable style flex:1 | pointerEvents"
    echo ""
    echo ">>> Matches:"
  } >> "$REPORT"

  # Greps non bloquants
  (grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
    -E "TouchableWithoutFeedback|onStartShouldSetResponder|onMoveShouldSetResponder|onStartShouldSetResponderCapture|onMoveShouldSetResponderCapture|GestureDetector|PanGestureHandler|Gesture\.Pan|Pressable|pointerEvents" \
    "$base" 2>/dev/null || true) >> "$REPORT"

  {
    echo ""
    echo ">>> Tip: cherche un wrapper plein écran (flex:1) autour d’un ScrollView/FlatList."
    echo ""
  } >> "$REPORT"
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

ln -sfn "$BK" "$LAST_LINK"

log "ROOT: $ROOT"
log "BACKUP: $BK"
log "REPORT: $REPORT"
log "LAST LINK: $LAST_LINK"

kill_ports

for app in "${APPS[@]}"; do
  if [[ ! -d "$ROOT/apps/$app" ]]; then
    warn "App absente: $app"
    continue
  fi
  set_env_flags "$app"
  patch_entry_routes "$app"
  scan_suspects "$app"
done

log "✅ Responder scalpel appliqué."
log "👉 Relance Expo avec --clear, swipe-close complet sur iPhone, re-scan QR."

cat <<EOF

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Rapport suspects:
$REPORT

Restore:
bash $ROOT/scripts/da_scroll_responder_scalpel.sh restore

EOF
