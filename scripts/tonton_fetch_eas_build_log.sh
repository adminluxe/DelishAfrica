#!/usr/bin/env bash
set -euo pipefail

APP="${1:-client}"
BUILD_ID="${2:-7a887464-76b2-48cd-8f01-dd05d36b4401}"

ROOT="/opt/delishafrica/monorepo"
OUTDIR="$ROOT/.tonton_reports/eas_logs"
mkdir -p "$OUTDIR"

JSON="/tmp/build_${APP}_${BUILD_ID}.json"
TXT="$OUTDIR/${APP}_${BUILD_ID}.xcode.log.txt"
RAW="$OUTDIR/${APP}_${BUILD_ID}.xcode.log.raw"
MINI="$OUTDIR/${APP}_${BUILD_ID}.errors.snip.txt"

echo "📦 Fetch EAS build JSON ($APP / $BUILD_ID)"
cd "$ROOT/apps/$APP"
eas build:view "$BUILD_ID" --json > "$JSON"

echo "🔎 Extract xcodeBuildLogsUrl"
LOGURL="$(node - <<'NODE'
const fs=require('fs');
const j=JSON.parse(fs.readFileSync(process.env.JSON,'utf8'));

function findUrl(x){
  if (typeof x === 'string' && x.includes('job-logs.eascdn.net') && x.includes('production-xcode-logs')) return x;
  if (!x || typeof x !== 'object') return null;
  if (Array.isArray(x)) { for (const v of x){ const r=findUrl(v); if (r) return r; } return null; }
  for (const k of Object.keys(x)){ const r=findUrl(x[k]); if (r) return r; }
  return null;
}
const u = findUrl(j);
if(!u){ process.exit(2); }
process.stdout.write(u);
NODE
)" JSON="$JSON"

echo "✅ LOGURL found"
echo "$LOGURL" | sed 's/[?].*/?.../'

echo "⬇️ Download xcode log"
curl -L "$LOGURL" -o "$RAW" >/dev/null 2>&1 || curl -L "$LOGURL" -o "$RAW"

echo "🧩 Normalize (gzip or plain)"
if file "$RAW" | rg -qi 'gzip'; then
  gzip -dc "$RAW" > "$TXT"
else
  cp "$RAW" "$TXT"
fi

echo "🔍 Extract likely error area => $MINI"
{
  echo "=== TOP error signals (first 250 matches) ==="
  rg -n "Install dependencies|installing|pnpm|npm|yarn|pod install|CocoaPods|error:|ERR!|fatal error|PhaseScriptExecution" "$TXT" | head -n 250 || true
  echo
  echo "=== LAST 200 lines ==="
  tail -n 200 "$TXT" || true
} > "$MINI"

echo
echo "✅ DONE"
echo "JSON: $JSON"
echo "TXT : $TXT"
echo "SNIP: $MINI"
echo
echo "Next: open SNIP:"
echo "  sed -n '1,220p' \"$MINI\""
