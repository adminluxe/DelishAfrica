#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

APP="${1:-client}"
BUILD_ID="${2:-}"
[[ -n "$BUILD_ID" ]] || { echo "Usage: $0 <client|merchant|courier> <BUILD_ID>"; exit 1; }

ROOT="/opt/delishafrica/monorepo"
APP_DIR="$ROOT/apps/$APP"
[[ -d "$APP_DIR" ]] || { echo "App inconnue: $APP_DIR"; exit 1; }

OUT="$ROOT/.tonton_reports/eas_log_hunter_${APP}_${BUILD_ID}_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT"

cd "$APP_DIR"

echo "✅ OUT=$OUT"

# 1) Fresh build JSON (URLs fraîches, non expirées)
eas build:view "$BUILD_ID" --json > "$OUT/build.json"

# 2) Extract ALL urls from JSON
BUILD_JSON="$OUT/build.json" node - <<'NODE' > "$OUT/urls_all.txt"
const fs=require('fs');
const j=JSON.parse(fs.readFileSync(process.env.BUILD_JSON,'utf8'));
const seen=new Set();
function walk(x){
  if(!x) return;
  if(typeof x==='string'){
    if(/^https?:\/\//.test(x) && !seen.has(x)){
      seen.add(x); console.log(x);
    }
    return;
  }
  if(Array.isArray(x)) return x.forEach(walk);
  if(typeof x==='object') for(const k of Object.keys(x)) walk(x[k]);
}
walk(j);
NODE

# 3) Candidates: job logs (NON xcode)
grep -E "job-logs\.eascdn\.net/production/" "$OUT/urls_all.txt" \
  | grep -viE "xcode|production-xcode-logs" \
  > "$OUT/candidates.txt" || true

echo "CANDIDATES=$(wc -l < "$OUT/candidates.txt" 2>/dev/null || echo 0)" | tee "$OUT/index.txt"
tail -n 6 "$OUT/candidates.txt" 2>/dev/null | sed 's/^/  - /' | tee -a "$OUT/index.txt" || true

# Helper: detect gz
is_gz(){
  local f="$1"
  python3 - <<PY "$f"
import sys
p=sys.argv[1]
b=open(p,'rb').read(2)
print("1" if b==b"\\x1f\\x8b" else "0")
PY
}

PAT='Install dependencies|@delishafrica/ui|Not found|yarn|pnpm|package-lock|yarn\.lock|ERR!|npm ERR'
FOUND=0
N=0

# Iterate fast: newest first
tac "$OUT/candidates.txt" | while read -r URL; do
  URL="$(echo -n "$URL" | tr -d '\r\n')"
  [[ -z "$URL" ]] && continue
  N=$((N+1))
  RAW="$OUT/raw_${N}.bin"
  TXT="$OUT/raw_${N}.txt"

  CODE="$(curl -sSL -L -w "%{http_code}" -o "$RAW" "$URL" || true)"
  BYTES="$(wc -c < "$RAW" 2>/dev/null || echo 0)"

  echo "TRY #$N HTTP=$CODE bytes=$BYTES" | tee -a "$OUT/index.txt"

  # If tiny error response, keep a preview (helps spot Expired/Denied)
  if [[ "$BYTES" -lt 1200 ]]; then
    head -c 400 "$RAW" | tr '\n' ' ' | sed 's/  */ /g' | sed 's/^/  preview: /' | tee -a "$OUT/index.txt" || true
  fi

  # decode text (handle gzip)
  if [[ "$(is_gz "$RAW")" == "1" ]]; then
    gzip -dc "$RAW" > "$TXT" 2>/dev/null || true
  else
    cp "$RAW" "$TXT" 2>/dev/null || true
  fi

  # Hit?
  if grep -qE "$PAT" "$TXT" 2>/dev/null; then
    echo "✅ HIT on TRY #$N (HTTP=$CODE bytes=$BYTES)" | tee "$OUT/HIT.txt"
    echo "URL=$URL" | tee -a "$OUT/HIT.txt"
    echo "" | tee -a "$OUT/HIT.txt"
    grep -nE "$PAT" "$TXT" | head -n 220 | tee -a "$OUT/HIT.txt"
    echo "" | tee -a "$OUT/HIT.txt"
    echo "---- tail 220 ----" | tee -a "$OUT/HIT.txt"
    tail -n 220 "$TXT" | tee -a "$OUT/HIT.txt"
    exit 0
  fi

  # Stop after some tries if you want (uncomment to cap)
  # [[ "$N" -ge 35 ]] && exit 0
done

echo "❌ No HIT found. See: $OUT/index.txt" | tee "$OUT/NO_HIT.txt"
