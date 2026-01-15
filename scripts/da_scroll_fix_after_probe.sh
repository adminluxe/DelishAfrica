#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/scroll_fix_after_probe_$TS"
REPORT_DIR="$ROOT/.tonton_backups/_reports"
REPORT="$REPORT_DIR/scroll_fix_report_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK" "$REPORT_DIR"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
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

set_env_clean() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  set_kv() {
    local k="$1" v="$2"
    grep -q "^$k=" "$envfile" \
      && sed -i "s|^$k=.*|$k=$v|" "$envfile" \
      || echo "$k=$v" >> "$envfile"
  }

  # On remet tout normal + on active un flag FIX
  set_kv "EXPO_PUBLIC_BG_OFF" "0"
  set_kv "EXPO_PUBLIC_SCROLL_DIAG" "0"
  set_kv "EXPO_PUBLIC_LAYOUT_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_RESPONDER_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_SCROLL_FIX" "1"

  log "$app: .env.local cleaned (BG_OFF=0, DIAG=0, scalpels=0) + SCROLL_FIX=1"
}

collect_tsx_files() {
  local base="$1"
  local dirs=("$base/app" "$base/components" "$base/ui" "$base/src")
  local files=()
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    while IFS= read -r f; do files+=("$f"); done < <(find "$d" -type f -name "*.tsx" 2>/dev/null)
  done
  printf "%s\n" "${files[@]}"
}

patch_file() {
  local f="$1"

  # Patch uniquement si ScrollView/FlatList/SectionList présent
  if ! grep -qE "<(ScrollView|FlatList|SectionList)\b" "$f" 2>/dev/null; then
    return 0
  fi

  backup_file "$f"

  # 1) Ajoute props clavier aux ScrollView/FlatList/SectionList (si absents)
  perl -0777 -i -pe '
    for my $tag (qw(ScrollView FlatList SectionList)) {
      s/<\Q$tag\E(?![^>]*\bkeyboardDismissMode=)/<${tag} keyboardDismissMode="on-drag"/gms;
      s/<\Q$tag\E(?![^>]*\bkeyboardShouldPersistTaps=)/<${tag} keyboardShouldPersistTaps="handled"/gms;
    }
  ' "$f"

  # 2) Si le fichier utilise Keyboard.dismiss, on neutralise les wrappers tactiles qui bloquent le scroll
  if grep -q "Keyboard\.dismiss" "$f" 2>/dev/null; then
    perl -0777 -i -pe '
      # TouchableWithoutFeedback: inject disabled si absent
      s/<TouchableWithoutFeedback(?![^>]*\bdisabled=)/<TouchableWithoutFeedback disabled={true}/gms;

      # Pressable: inject disabled si absent
      s/<Pressable(?![^>]*\bdisabled=)/<Pressable disabled={true}/gms;

      # TouchableOpacity/Highlight (rare en wrapper plein écran): inject disabled si absent
      s/<TouchableOpacity(?![^>]*\bdisabled=)/<TouchableOpacity disabled={true}/gms;
      s/<TouchableHighlight(?![^>]*\bdisabled=)/<TouchableHighlight disabled={true}/gms;
    ' "$f"
  fi
}

log "ROOT: $ROOT"
log "BACKUP: $BK"
log "REPORT: $REPORT"

kill_ports

{
  echo "=== Scroll Fix After Probe ==="
  echo "Date: $(date)"
  echo "Backup: $BK"
  echo ""
} > "$REPORT"

for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  if [[ ! -d "$base" ]]; then
    warn "App absente: $app"
    continue
  fi

  set_env_clean "$app"

  log "$app: scanning & patching tsx..."
  files="$(collect_tsx_files "$base" || true)"
  patched=0
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    before="$(cksum "$f" | awk '{print $1}' || true)"
    patch_file "$f"
    after="$(cksum "$f" | awk '{print $1}' || true)"
    if [[ -n "$before" && -n "$after" && "$before" != "$after" ]]; then
      patched=$((patched+1))
      echo "$app patched: ${f#"$ROOT"/}" >> "$REPORT"
    fi
  done <<< "$files"

  echo "" >> "$REPORT"
  echo "$app: patched_files=$patched" >> "$REPORT"
  echo "" >> "$REPORT"
done

log "✅ Fix appliqué."
log "👉 Relance Expo avec --clear, swipe-close iPhone, re-scan QR."
cat <<EOF

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Rapport:
$REPORT
Backups:
$BK
EOF
