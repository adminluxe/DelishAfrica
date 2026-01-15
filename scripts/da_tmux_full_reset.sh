#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_DEV"

echo "==> ROOT=$ROOT"
cd "$ROOT"

echo "==> (A) Backup + FIX anti-backslashes dans _layout.tsx (cause du TSX: Expecting Unicode escape...)"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/layout_sanitize_$TS"
mkdir -p "$BK"

fix_layout() {
  local f="$1"
  [ -f "$f" ] || return 0
  mkdir -p "$BK/$(dirname "$f")"
  cp -f "$f" "$BK/$f"

  python3 - <<PY
from pathlib import Path
p=Path("$f")
s=p.read_text(encoding="utf-8", errors="replace")

# Cas toxiques vus: name=\"index\" / title: \'DelishAfrica\' / options={{ title: \'...\' }}
# => on retire les backslashes "littéraux" qui cassent le TSX.
s2=s.replace('\\"','"').replace("\\'","'")

# Optionnel: si on a encore title: 'DelishAfrica' on préfère du double-quote propre
import re
s2=re.sub(r"title:\s*'([^']*)'", r'title: "\1"', s2)
# JSX attribute: name='index' -> name="index" (propre)
s2=re.sub(r"name='([^']*)'", r'name="\1"', s2)

if s2 != s:
  p.write_text(s2, encoding="utf-8")
  print("PATCHED", p)
else:
  print("NOCHANGE", p)
PY
}

fix_layout "$ROOT/apps/client/app/_layout.tsx"
fix_layout "$ROOT/apps/courier/app/_layout.tsx"
fix_layout "$ROOT/apps/merchant/app/_layout.tsx"

echo "==> (B) Kill tmux sessions (delish + DA_DEV) pour repartir sur 1 seule"
tmux kill-session -t delish 2>/dev/null || true
tmux kill-session -t DA_DEV 2>/dev/null || true

echo "==> (C) Kill process dormants (expo/metro/ngrok/node liés)"
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true

echo "==> (D) Libère ports (expo + ngrok admin + legacy)"
for p in 8801 8802 8803 4040 4041 4042 4043 4049 19000 19001 19002 19006 8081 8082 8083; do
  fuser -k ${p}/tcp 2>/dev/null || true
done

echo "==> (E) Détecte la plateforme (delishafrica-ops / platform)"
PLATFORM_DIR=""
for d in \
  "$ROOT/apps/platform" \
  "$ROOT/apps/delishafrica-ops" \
  "$ROOT/apps/ops" \
  "$ROOT/delishafrica-ops" \
  "$ROOT/platform" \
  "$ROOT/apps/admin"
do
  if [ -f "$d/package.json" ]; then PLATFORM_DIR="$d"; break; fi
done
echo "==> PLATFORM_DIR=${PLATFORM_DIR:-<not found>}"

echo "==> (F) Crée session tmux $SESSION + fenêtres complètes"
tmux new-session -d -s "$SESSION" -n shell "cd $ROOT && bash"

tmux new-window -t "$SESSION" -n api-logs "bash -lc 'cd $ROOT && echo \"API logs: lance ici ta commande de logs (pm2/journalctl/pnpm)\"; echo \"Ex: pm2 logs || journalctl -fu delish-api || (cd services/api-rest && pnpm start:dev)\"; exec bash'"

tmux new-window -t "$SESSION" -n client  "bash -lc 'cd $ROOT/apps/client  && npx expo start --dev-client --tunnel --port 8801 --clear'"
tmux new-window -t "$SESSION" -n courier "bash -lc 'cd $ROOT/apps/courier && npx expo start --dev-client --tunnel --port 8802 --clear'"
tmux new-window -t "$SESSION" -n merchant "bash -lc 'cd $ROOT/apps/merchant && npx expo start --dev-client --tunnel --port 8803 --clear'"

tmux new-window -t "$SESSION" -n platform "bash -lc '
  if [ -n \"${PLATFORM_DIR}\" ]; then
    cd \"${PLATFORM_DIR}\"
    echo \"Platform in: ${PLATFORM_DIR}\"
    (pnpm dev || pnpm start || npm run dev || npm start || true)
    exec bash
  else
    echo \"Platform dir introuvable. Cherche avec: ls -la $ROOT/apps\"
    exec bash
  fi
'"

tmux new-window -t "$SESSION" -n ports "bash -lc 'watch -n 1 \"ss -lntp | egrep \\\":(8801|8802|8803|4040|4041|4042|4043|4049|3010|8081|8082|8083|19000|19001|19002|19006)\\\\b\\\" || true\"'"

tmux new-window -t "$SESSION" -n grep "bash -lc 'cd $ROOT && echo \"grep helper (ex): grep -RIn --include=\\\"*.tsx\\\" index apps\"; exec bash'"
tmux new-window -t "$SESSION" -n notes "bash -lc 'cd $ROOT && echo \"Notes: Ctrl+b 0..9 pour naviguer. QR doivent apparaître dans client/courier/merchant.\"; exec bash'"

tmux select-window -t "$SESSION":shell
echo "==> OK. Attach: tmux attach -t $SESSION"
echo "==> Backup layouts: $BK"
