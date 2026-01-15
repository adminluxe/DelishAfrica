#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP_ROOT="$ROOT/.tonton_backups/scroll_reset_$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="/tmp"
SESSION="${TMUX_SESSION:-DA_REL}"

# Ports qu’on nettoie (Expo/Metro + tunnels)
PORTS_TO_FREE=(8081 8082 8083 8084 8085 8086 4040 4049 19000 19001 19002 19006 19007 3010)

APPS=(client courier merchant)
declare -A APP_PORTS=( ["client"]=8081 ["courier"]=8082 ["merchant"]=8083 )

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[DA ERR]\033[0m %s\n" "$*"; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Commande requise introuvable: $1"; }

kill_port() {
  local p="$1"
  local pids=""
  pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    warn "Port $p occupé → kill: ${pids}"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

kill_patterns() {
  # On cible large mais safe (process Expo/Metro/ngrok)
  local patterns=(
    "pnpm.*expo start"
    "expo start"
    "expo-dev-server"
    "metro"
    "@expo/ngrok"
    "ngrok"
  )
  for pat in "${patterns[@]}"; do
    pkill -f "$pat" 2>/dev/null || true
  done
}

clean_caches() {
  log "Purge caches globales (/tmp + caches Metro)"
  rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true

  for app in "${APPS[@]}"; do
    local dir="$ROOT/apps/$app"
    [[ -d "$dir" ]] || continue
    log "Purge caches app: $dir"
    rm -rf \
      "$dir/.expo" \
      "$dir/.expo-shared" \
      "$dir/.metro-cache" \
      "$dir/node_modules/.cache" \
      2>/dev/null || true
  done
}

run_scroll_report() {
  local script="$ROOT/scripts/da_scroll_report.sh"
  if [[ -x "$script" ]]; then
    log "Scan scroll (rapport) via: $script"
    "$script" > "$REPORT_DIR/da_scroll_report_$(date +%Y%m%d_%H%M%S).txt" || true
    log "Rapport: $(ls -1t $REPORT_DIR/da_scroll_report_*.txt 2>/dev/null | head -n 1 || true)"
  else
    warn "da_scroll_report.sh introuvable ou non exécutable: $script (ok, on continue)"
  fi
}

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

patch_parallax() {
  # Patch idempotent sur components/parallax-scroll-view.tsx (dans chaque app)
  # Objectif: s’assurer que le ScrollView est scrollable même si quelqu’un a mis scrollEnabled={false}
  # + header overlay ne capte pas les touches.
  local changed=0

  for app in "${APPS[@]}"; do
    local f="$ROOT/apps/$app/components/parallax-scroll-view.tsx"
    [[ -f "$f" ]] || continue

    log "Patch ParallaxScrollView: $f"
    backup_file "$f"

    # 1) Forcer scrollEnabled={true} sur <Animated.ScrollView ...>
    #    - Si un scrollEnabled existe → on le remplace par true
    #    - Sinon → on l’ajoute juste après l’ouverture du tag
    perl -0777 -i -pe '
      # Remplace scrollEnabled={...} existant
      s/<Animated\.ScrollView([^>]*?)\bscrollEnabled\s*=\s*\{[^}]*\}([^>]*?)>/
        "<Animated.ScrollView$1 scrollEnabled={true}$2>"
      /gse;

      # Ajoute scrollEnabled={true} si absent
      s/<Animated\.ScrollView(?![^>]*\bscrollEnabled\s*=)([^>]*)>/
        "<Animated.ScrollView$1 scrollEnabled={true}>"
      /gse;
    ' "$f"

    # 2) S’assurer que le header overlay ne bloque pas (pointerEvents="none" sur <Animated.View ...>)
    perl -0777 -i -pe '
      s/<Animated\.View([^>]*?)\bpointerEvents\s*=\s*"[^"]*"([^>]*?)>/
        "<Animated.View$1 pointerEvents=\"none\"$2>"
      /gse;

      s/<Animated\.View(?![^>]*\bpointerEvents\s*=)([^>]*)>/
        "<Animated.View pointerEvents=\"none\"$1>"
      /gse;
    ' "$f"

    # 3) Bonus “safe iOS” (ne casse rien si déjà présent)
    #    keyboardShouldPersistTaps + contentInsetAdjustmentBehavior
    perl -0777 -i -pe '
      s/<Animated\.ScrollView([^>]*?)\bkeyboardShouldPersistTaps\s*=\s*"[^"]*"([^>]*?)>/
        "<Animated.ScrollView$1 keyboardShouldPersistTaps=\"handled\"$2>"
      /gse;
      s/<Animated\.ScrollView(?![^>]*\bkeyboardShouldPersistTaps\s*=)([^>]*)>/
        "<Animated.ScrollView$1 keyboardShouldPersistTaps=\"handled\">"
      /gse;

      s/<Animated\.ScrollView([^>]*?)\bcontentInsetAdjustmentBehavior\s*=\s*"[^"]*"([^>]*?)>/
        "<Animated.ScrollView$1 contentInsetAdjustmentBehavior=\"automatic\"$2>"
      /gse;
      s/<Animated\.ScrollView(?![^>]*\bcontentInsetAdjustmentBehavior\s*=)([^>]*)>/
        "<Animated.ScrollView$1 contentInsetAdjustmentBehavior=\"automatic\">"
      /gse;
    ' "$f"

    changed=$((changed+1))
  done

  if [[ "$changed" -gt 0 ]]; then
    log "Patch Parallax OK (backups dans: $BACKUP_ROOT)"
  else
    warn "Aucun fichier parallax-scroll-view.tsx trouvé (ok, on continue)"
  fi
}

print_rg_helpers() {
  log "Commandes de scan utiles (au cas où) :"
  cat <<EOF
  # Chercher les scrollEnabled={false}
  rg -n --hidden --glob '!**/.tonton_backups/**' --glob '!**/.backups/**' 'scrollEnabled\\s*=\\s*\\{false\\}' "$ROOT/apps"

  # Chercher les overlays absolute susceptibles de capter les touches
  rg -n --hidden --glob '!**/.tonton_backups/**' --glob '!**/.backups/**' 'position:\\s*["'\'']absolute["'\'']|StyleSheet\\.absoluteFill|absoluteFillObject|pointerEvents\\s*=\\s*["'\'']auto["'\'']' "$ROOT/apps"
EOF
}

api_health_check() {
  log "Health check API (local) :"
  curl -fsS "http://127.0.0.1:3010/api/v1/health" >/dev/null && echo "✅ API local OK (3010)" || warn "API local KO sur 3010 (si normal chez toi, ignore)"
}

start_expo_cmds() {
  log "Commandes Expo GOLD (tunnel + clear) :"
  cat <<EOF

  # CLIENT (8081)
  cd $ROOT/apps/client && pnpm exec expo start --dev-client --tunnel --clear --port 8081

  # COURIER (8082)
  cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082

  # MERCHANT (8083)
  cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

EOF
}

tmux_send_if_possible() {
  # Optionnel: envoi automatique dans tmux si session trouvée
  if ! command -v tmux >/dev/null 2>&1; then
    warn "tmux non trouvé → je n’injecte rien. (commands affichées juste après)"
    return 0
  fi

  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    warn "Session tmux '$SESSION' introuvable → je n’injecte rien. (commands affichées juste après)"
    return 0
  fi

  log "tmux détecté (session: $SESSION). Injection auto si fenêtres nommées client/courier/merchant…"

  send_to_window() {
    local win_match="$1"
    local cmd="$2"
    local win_id=""
    win_id="$(tmux list-windows -t "$SESSION" -F '#{window_index}:#{window_name}' | awk -F: -v m="$win_match" '$2 ~ m {print $1; exit}')"
    if [[ -n "$win_id" ]]; then
      tmux send-keys -t "$SESSION:$win_id" C-c 2>/dev/null || true
      tmux send-keys -t "$SESSION:$win_id" "$cmd" C-m
      log "→ Injecté dans window $win_id ($win_match)"
    else
      warn "Fenêtre tmux non trouvée pour: $win_match (ok, tu colleras manuellement)"
    fi
  }

  send_to_window "client"  "cd $ROOT/apps/client && pnpm exec expo start --dev-client --tunnel --clear --port 8081"
  send_to_window "courier" "cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082"
  send_to_window "merchant" "cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083"
}

main() {
  need_cmd lsof
  need_cmd perl
  need_cmd rg
  need_cmd curl

  [[ -d "$ROOT" ]] || die "Repo introuvable: $ROOT"

  log "ROOT: $ROOT"
  mkdir -p "$BACKUP_ROOT"

  log "1) Kill process Expo/Metro/ngrok"
  kill_patterns

  log "2) Libération des ports"
  for p in "${PORTS_TO_FREE[@]}"; do
    kill_port "$p"
  done

  log "3) Purge caches"
  clean_caches

  log "4) Scan scroll report (si script présent)"
  run_scroll_report

  log "5) Patch ParallaxScrollView (scrollEnabled + pointerEvents)"
  patch_parallax

  log "6) Health check API"
  api_health_check

  log "7) (Optionnel) Injection auto dans tmux"
  tmux_send_if_possible

  log "8) Commandes à lancer (si pas injecté) :"
  start_expo_cmds

  print_rg_helpers

  log "9) Checklist iPhone (ULTRA IMPORTANT) :"
  cat <<'EOF'
  - Fermer complètement les 3 apps (swipe up, pas juste Reload)
  - Re-scan les QR (tunnel exp.direct)
  - Tester scroll sur une liste (timeline / cards) + tester scroll en touchant "vide"
EOF

  log "DONE ✅ (Backups: $BACKUP_ROOT)"
}

main "$@"
