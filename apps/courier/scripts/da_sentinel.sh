#!/usr/bin/env bash
set -u

# DelishAfrica — Sentinel (READ-ONLY)
# Objectif: donner un état des lieux clair (tmux / ports / docker / API / env Expo)
# AUCUN kill, AUCUNE modif, que du diagnostic.

TS="$(date +%Y%m%d_%H%M%S)"
OUT="${OUT:-/tmp/DA_SENTINEL_${TS}.txt}"

MONOREPO="${MONOREPO:-/opt/delishafrica/monorepo}"
LEGACY="${LEGACY:-/opt/delishafrica-coursiers}"

API_LOCAL="${API_LOCAL:-http://127.0.0.1:3010}"
API_PUBLIC="${API_PUBLIC:-https://api.delishafrica.me}"

PORTS_DEFAULT=("3010" "5173" "3000" "3001" "8081" "8082" "8083" "8084" "8085" "8086" "8801" "8802" "8803" "19000" "19001" "19002" "4040")

have() { command -v "$1" >/dev/null 2>&1; }

hr() { printf "\n%s\n" "============================================================"; }
sec() { hr; printf "%s\n" "$1"; }

run() {
  # shellcheck disable=SC2129
  echo "\$ $*" >> "$OUT"
  # capture stdout+stderr
  ( "$@" ) >> "$OUT" 2>&1 || echo "[WARN] cmd failed: $*" >> "$OUT"
}

curl_try() {
  local url="$1"
  if have curl; then
    echo "\$ curl -fsS --max-time 3 $url" >> "$OUT"
    curl -fsS --max-time 3 "$url" >> "$OUT" 2>&1 || echo "[FAIL] $url" >> "$OUT"
    echo "" >> "$OUT"
  else
    echo "[SKIP] curl not installed" >> "$OUT"
  fi
}

echo "DA SENTINEL — $(date -Is)" > "$OUT"
echo "host: $(hostname) | user: $(whoami) | pwd: $(pwd)" >> "$OUT"

sec "0) System"
run uname -a
run uptime
run df -h
run free -h

sec "1) Repos presence"
echo "MONOREPO: $MONOREPO" >> "$OUT"
echo "LEGACY  : $LEGACY" >> "$OUT"
run ls -la "$MONOREPO"
run ls -la "$LEGACY"

sec "2) Git status (monorepo)"
if [ -d "$MONOREPO/.git" ]; then
  run bash -lc "cd '$MONOREPO' && git rev-parse --show-toplevel"
  run bash -lc "cd '$MONOREPO' && git status -sb"
  run bash -lc "cd '$MONOREPO' && git log -1 --oneline --decorate"
else
  echo "[WARN] No .git in MONOREPO" >> "$OUT"
fi

sec "3) tmux sessions/windows"
if have tmux; then
  run tmux ls
  # try common sessions
  for s in "DA_DEV" "delish" "DA" "DEV"; do
    run tmux list-windows -t "$s"
  done
else
  echo "[SKIP] tmux not installed" >> "$OUT"
fi

sec "4) Ports listeners (ss/lsof)"
if have ss; then
  echo "Listening sockets (filtered):" >> "$OUT"
  echo "\$ ss -lntp" >> "$OUT"
  ss -lntp >> "$OUT" 2>&1 || true
  echo "" >> "$OUT"
  echo "Filtered ports:" >> "$OUT"
  for p in "${PORTS_DEFAULT[@]}"; do
    echo "---- :$p ----" >> "$OUT"
    ss -lntp 2>/dev/null | grep -E ":${p}\b" >> "$OUT" || echo "(none)" >> "$OUT"
  done
else
  echo "[SKIP] ss not installed" >> "$OUT"
fi

if have lsof; then
  echo "" >> "$OUT"
  echo "lsof (listeners):" >> "$OUT"
  for p in "${PORTS_DEFAULT[@]}"; do
    echo "---- :$p ----" >> "$OUT"
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >> "$OUT" 2>&1 || echo "(none)" >> "$OUT"
  done
else
  echo "[SKIP] lsof not installed" >> "$OUT"
fi

sec "5) Docker status"
if have docker; then
  run docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
  if have docker && have bash && [ -f "$MONOREPO/docker-compose.yml" ]; then
    run bash -lc "cd '$MONOREPO' && docker compose ps"
  else
    echo "[INFO] No docker-compose.yml at $MONOREPO (or docker compose missing)" >> "$OUT"
  fi
else
  echo "[SKIP] docker not installed" >> "$OUT"
fi

sec "6) API checks (local + public)"
echo "API_LOCAL : $API_LOCAL" >> "$OUT"
echo "API_PUBLIC: $API_PUBLIC" >> "$OUT"

curl_try "$API_LOCAL/api/health"
curl_try "$API_LOCAL/api/v1/health"
curl_try "$API_PUBLIC/api/health"
curl_try "$API_PUBLIC/api/partners"
curl_try "$API_PUBLIC/api/partners/thieyp"

sec "7) Demo Orders endpoints (if present)"
curl_try "$API_LOCAL/api/v1/orders/demo/list"
curl_try "$API_LOCAL/api/v1/orders/demo/get"
curl_try "$API_LOCAL/api/v1/orders/demo/create"

sec "8) Expo env sanity (EXPO_PUBLIC_API_BASE_URL)"
if have rg; then
  run rg -n "EXPO_PUBLIC_API_BASE_URL" "$MONOREPO/apps" -S || true
elif have grep; then
  run bash -lc "grep -RIn \"EXPO_PUBLIC_API_BASE_URL\" \"$MONOREPO/apps\" 2>/dev/null | head -n 200"
else
  echo "[SKIP] neither rg nor grep" >> "$OUT"
fi

sec "9) Expo/Metro processes (best effort)"
if have pgrep; then
  run pgrep -af "expo( |-)start|expo-dev-server|metro|react-native|ngrok|vite|next" || true
else
  echo "[SKIP] pgrep not installed" >> "$OUT"
fi

hr
echo "DONE. Report: $OUT"
echo "DONE. Report: $OUT" >> "$OUT"
