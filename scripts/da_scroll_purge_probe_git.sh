#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/purge_probe_git_$TS"
REPORT="$ROOT/.tonton_backups/_reports/purge_probe_git_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK" "$(dirname "$REPORT")"
: > "$REPORT"

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

git_restore_file() {
  local f="$1"
  # restore tracked file from HEAD (worktree + staged)
  git -C "$ROOT" restore --source=HEAD --staged --worktree -- "$f" 2>/dev/null \
    || git -C "$ROOT" checkout -- "$f" 2>/dev/null \
    || { warn "Cannot git-restore: $f (untracked?)"; return 0; }
}

set_env_normal() {
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

  set_kv "EXPO_PUBLIC_BG_OFF" "0"
  set_kv "EXPO_PUBLIC_SCROLL_DIAG" "0"
  set_kv "EXPO_PUBLIC_LAYOUT_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_RESPONDER_SCALPEL" "0"
  set_kv "EXPO_PUBLIC_SCROLL_FIX" "0"
}

require_git() {
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Repo git non détecté dans $ROOT. Script Git-restore ne peut pas fonctionner."
    warn "Fallback: utilise da_scroll_remove_probe_now.sh (backups) ou restore manuel."
    exit 1
  fi
}

log "ROOT: $ROOT"
log "BACKUP: $BK"
log "REPORT: $REPORT"

require_git
kill_ports

echo "=== git status (before) ===" >> "$REPORT"
git -C "$ROOT" status --porcelain >> "$REPORT" || true
echo "" >> "$REPORT"

PATTERN='SCROLL PROBE|ScrollProbe|If this scrolls|LAYOUT SCALPEL|EXPO_PUBLIC_LAYOUT_SCALPEL|EXPO_PUBLIC_RESPONDER_SCALPEL'

for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  [[ -d "$base" ]] || { warn "App missing: $app"; continue; }

  log "$app: normalize env flags"
  set_env_normal "$app"

  log "$app: find & restore probe/scalpel files"
  mapfile -t hits < <(grep -RIl --exclude-dir=node_modules --exclude-dir=.git -E "$PATTERN" \
    "$base/app" "$base/components" "$base/src" "$base/ui" 2>/dev/null || true)

  if [[ "${#hits[@]}" -eq 0 ]]; then
    log "$app: no probe/scalpel markers found ✅"
    continue
  fi

  echo "APP=$app" >> "$REPORT"
  for f in "${hits[@]}"; do
    rel="${f#"$ROOT"/}"
    echo "restore: $rel" >> "$REPORT"
    backup_file "$f"
    git_restore_file "$rel"
  done
  echo "" >> "$REPORT"
done

log "Leftover scan (should be empty)"
for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  [[ -d "$base" ]] || continue
  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "$PATTERN" \
    "$base/app" "$base/components" "$base/src" "$base/ui" 2>/dev/null >> "$REPORT" || true
done

echo "" >> "$REPORT"
echo "=== git status (after) ===" >> "$REPORT"
git -C "$ROOT" status --porcelain >> "$REPORT" || true

log "✅ PURGE done."
cat <<EOF

👉 Relance Expo (IMPORTANT: --clear):

# CLIENT
cd $ROOT/apps/client   && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier  && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Report:
$REPORT
Backups:
$BK

EOF
