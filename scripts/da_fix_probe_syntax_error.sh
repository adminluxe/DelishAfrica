#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/fix_probe_syntax_$TS"
REPORT="$ROOT/.tonton_backups/_reports/fix_probe_syntax_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK" "$(dirname "$REPORT")"
: > "$REPORT"

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

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

is_broken_return_outside() {
  local f="$1"
  # Heuristique: "return (" présent + aucun "export default function" ni "function " avant
  grep -qE '^[[:space:]]*return[[:space:]]*\(' "$f" || return 1
  grep -qE 'export[[:space:]]+default[[:space:]]+function|function[[:space:]]+[A-Za-z_]|=>[[:space:]]*\(' "$f" && return 1
  return 0
}

has_probe_markers() {
  local f="$1"
  grep -qE 'SCROLL PROBE|If this scrolls|Array\.from\(\{[[:space:]]*length:[[:space:]]*120|Row[[:space:]]+\{n\}|ScrollProbe|LAYOUT SCALPEL' "$f"
}

ensure_git_repo() {
  git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

git_restore_rel() {
  local rel="$1"
  git -C "$ROOT" restore --source=HEAD --staged --worktree -- "$rel" 2>/dev/null \
    || git -C "$ROOT" checkout -- "$rel" 2>/dev/null \
    || return 1
}

latest_backup_dir() {
  local prefix="$1"
  ls -1dt "$ROOT/.tonton_backups/${prefix}_"* 2>/dev/null | head -n 1 || true
}

restore_from_backup_any() {
  local rel="$1"
  # tente depuis les derniers backups connus
  local b
  for prefix in responder_scalpel layout_scalpel true_scalpel; do
    b="$(latest_backup_dir "$prefix")"
    [[ -n "$b" && -f "$b/$rel" ]] && { cp -a "$b/$rel" "$ROOT/$rel"; return 0; }
  done
  return 1
}

unlock_if_immutable() {
  local f="$1"
  command -v lsattr >/dev/null 2>&1 || return 0
  command -v chattr >/dev/null 2>&1 || return 0
  # si immutable, on déverrouille
  if lsattr "$f" 2>/dev/null | awk '{print $1}' | grep -q 'i'; then
    warn "immutable detected -> chattr -i $f"
    chattr -i "$f" || true
  fi
}

set_env_flags_off() {
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
}

log "ROOT: $ROOT"
log "BACKUP: $BK"
log "REPORT: $REPORT"

kill_ports

if ! ensure_git_repo; then
  warn "Git repo non détecté dans $ROOT. On tentera uniquement les backups .tonton_backups."
fi

echo "=== Fix probe syntax error — $TS ===" >> "$REPORT"
echo "Backup: $BK" >> "$REPORT"
echo "" >> "$REPORT"

for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  [[ -d "$base" ]] || { warn "App missing: $app"; continue; }

  log "$app: disable scalpel env flags"
  set_env_flags_off "$app"

  appdir="$base/app"
  [[ -d "$appdir" ]] || { warn "$app: no app/ directory"; continue; }

  # Cibles prioritaires (ton erreur montre (tabs)/index.tsx)
  targets=(
    "$appdir/(tabs)/index.tsx"
    "$appdir/index.tsx"
    "$appdir/(home)/index.tsx"
    "$appdir/home/index.tsx"
    "$appdir/(root)/index.tsx"
  )

  # + fallback: tous les index.tsx maxdepth 4
  mapfile -t extra < <(find "$appdir" -maxdepth 4 -type f -name "index.tsx" 2>/dev/null || true)

  files=("${targets[@]}" "${extra[@]}")

  fixed=0
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || continue
    rel="${f#"$ROOT"/}"

    if has_probe_markers "$f" || is_broken_return_outside "$f"; then
      unlock_if_immutable "$f"
      backup_file "$f"

      if ensure_git_repo && git_restore_rel "$rel"; then
        echo "[$app] git-restored: $rel" >> "$REPORT"
        fixed=$((fixed+1))
        continue
      fi

      if restore_from_backup_any "$rel"; then
        echo "[$app] restored-from-backup: $rel" >> "$REPORT"
        fixed=$((fixed+1))
        continue
      fi

      warn "Could not restore $rel (not in git? not in backups?)"
      echo "[$app] FAILED-RESTORE: $rel" >> "$REPORT"
    fi
  done

  log "$app: restored files = $fixed"
done

log "Leftover scan (should be EMPTY)"
PATTERN='SCROLL PROBE|If this scrolls|Array\.from\(\{[[:space:]]*length:[[:space:]]*120|ScrollProbe|LAYOUT SCALPEL|Row[[:space:]]+\{n\}'
for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  [[ -d "$base" ]] || continue
  echo "" >> "$REPORT"
  echo "=== LEFTOVERS $app ===" >> "$REPORT"
  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "$PATTERN" \
    "$base/app" "$base/src" "$base/components" "$base/ui" 2>/dev/null >> "$REPORT" || true
done

log "✅ Fix done. Restart Expo with --clear."

cat <<EOF

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
