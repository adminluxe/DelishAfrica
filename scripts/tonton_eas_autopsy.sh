#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true  # disable history expansion (!)

die(){ echo "✖ $*" >&2; exit 1; }
ok(){ echo "✔ $*"; }
warn(){ echo "⚠ $*" >&2; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

need eas
need curl
need node

find_root() {
  local d="${PWD}"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/apps" && ( -f "$d/pnpm-workspace.yaml" || -f "$d/package.json" ) ]]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

ROOT="$(find_root || true)"
[[ -n "${ROOT:-}" ]] || ROOT="/opt/delishafrica/monorepo"
[[ -d "$ROOT/apps" ]] || die "Monorepo root introuvable. Attendu: $ROOT/apps"

APP="${1:-}"
BUILD_ID="${2:-}"
MODE="${3:-}"

if [[ -z "$APP" ]]; then
  cat >&2 <<EOF
Usage:
  $0 <client|merchant|courier> [BUILD_ID|--auto]

Exemples:
  $0 client --auto
  $0 client 7a887464-76b2-48cd-8f01-dd05d36b4401
EOF
  exit 2
fi

APP_DIR="$ROOT/apps/$APP"
[[ -d "$APP_DIR" ]] || die "App inconnue: $APP_DIR"

ts="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT/.tonton_reports/eas_autopsy_${APP}_${ts}"
mkdir -p "$OUT_DIR"
ok "TONTON EAS AUTOPSY"
echo "Root: $ROOT"
echo "App : $APP ($APP_DIR)"
echo "Out : $OUT_DIR"

cd "$APP_DIR"

# --- Pick build id automatically if asked ---
if [[ "${BUILD_ID:-}" == "--auto" || -z "${BUILD_ID:-}" ]]; then
  warn "BUILD_ID manquant -> tentative auto via eas build:list"
  if eas build:list --limit 20 --json >"$OUT_DIR/build_list.json" 2>"$OUT_DIR/build_list.err"; then
    BUILD_ID="$(node - <<'NODE' "$OUT_DIR/build_list.json"
const fs=require('fs');
const p=process.argv[1];
let j=JSON.parse(fs.readFileSync(p,'utf8'));
if(!Array.isArray(j)) j=j.builds||j.data||[];
const pick = j.find(b => String(b.status||'').toLowerCase().includes('error')) || j[0];
if(!pick) process.exit(2);
process.stdout.write(String(pick.id||''));
NODE
)"
  else
    die "Impossible de lister les builds. Voir: $OUT_DIR/build_list.err"
  fi
fi

[[ -n "${BUILD_ID:-}" ]] || die "BUILD_ID introuvable (auto a échoué)."

echo "Build: $BUILD_ID"
echo

# --- Fetch build json ---
ok "1) Fetch build JSON…"
if eas build:view "$BUILD_ID" --json >"$OUT_DIR/build.json" 2>"$OUT_DIR/build_view.err"; then
  ok "build.json"
else
  warn "eas build:view a échoué. Voir $OUT_DIR/build_view.err"
fi

# --- Extract key URLs ---
ok "2) Extract URLs…"
node - <<'NODE' "$OUT_DIR/build.json" >"$OUT_DIR/urls.txt" || true
const fs=require('fs');
const p=process.argv[1];
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const owner=j?.project?.ownerAccount?.name || j?.initiatingActor?.displayName || 'unknown';
const slug=j?.project?.slug || 'unknown';
const buildId=j?.id || 'unknown';
const buildUrl = j?.buildUrl || `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${buildId}`;
const xcode = j?.artifacts?.xcodeBuildLogsUrl || '';
const logFiles = j?.logFiles || [];
console.log(`owner=${owner}`);
console.log(`slug=${slug}`);
console.log(`buildId=${buildId}`);
console.log(`buildUrl=${buildUrl}`);
console.log(`xcodeBuildLogsUrl=${xcode}`);
if (Array.isArray(logFiles) && logFiles.length) {
  console.log(`logFilesCount=${logFiles.length}`);
  for (const f of logFiles) console.log(`logFile=${JSON.stringify(f)}`);
} else {
  console.log(`logFilesCount=0`);
}
NODE
ok "urls.txt"

BUILD_URL="$(grep -E '^buildUrl=' "$OUT_DIR/urls.txt" | head -n1 | cut -d= -f2- || true)"
XCODE_URL="$(grep -E '^xcodeBuildLogsUrl=' "$OUT_DIR/urls.txt" | head -n1 | cut -d= -f2- || true)"

echo
echo "Build page : ${BUILD_URL:-"(unknown)"}"
echo "Xcode logs : ${XCODE_URL:-"(none)"}"
echo

# --- Download logs (if present) ---
ok "3) Download log…"
RAW="$OUT_DIR/eas_xcode_build.raw"
TXT="$OUT_DIR/eas_xcode_build.txt"
TAIL="$OUT_DIR/tail_200.txt"

if [[ -n "${XCODE_URL:-}" ]]; then
  # best effort download; don't hard-fail
  if curl -fsSL --retry 3 --retry-delay 2 "$XCODE_URL" -o "$RAW"; then
    ok "Downloaded raw -> $RAW"
  else
    warn "Download logs FAILED (curl)."
    echo "curl_failed=1" > "$OUT_DIR/download_state.txt"
  fi
else
  warn "Pas de xcodeBuildLogsUrl dans build.json."
fi

# Convert raw -> txt (strip tags if HTML/XML)
if [[ -f "$RAW" ]]; then
  # If it's HTML/XML error, keep it readable
  sed -E 's/<[^>]+>/ /g; s/[[:space:]]+/ /g' "$RAW" > "$TXT" || cp -f "$RAW" "$TXT"
  ok "Converted -> $TXT"
  tail -n 200 "$TXT" > "$TAIL" || true
  ok "Tail -> $TAIL"
fi

# Detect NoSuchKey (logs purged/missing)
if [[ -f "$TXT" ]] && grep -qi 'NoSuchKey' "$TXT"; then
  warn "Logs xcode introuvables côté stockage (NoSuchKey). Probable purge/retention."
  echo "no_such_key=1" > "$OUT_DIR/logs_state.txt"
  echo "➡ Ouvre la page build et relance un build frais pour avoir des logs récupérables:" > "$OUT_DIR/NEXT.txt"
  echo "   ${BUILD_URL:-"(buildUrl inconnu)"}" >> "$OUT_DIR/NEXT.txt"
fi

# --- Quick root-cause grep ---
ok "4) Scan patterns…"
if [[ -f "$TXT" ]]; then
  grep -nE 'Install dependencies|pod install|CocoaPods|PhaseScriptExecution|ERR!|error:|fatal|pnpm|yarn|npm|expo prebuild|Command failed' "$TXT" \
    | head -n 120 > "$OUT_DIR/errors_top.txt" || true
  ok "errors_top.txt"
else
  warn "Pas de log texte à scanner."
fi

echo
ok "FIN ✅"
echo "Dossier rapport: $OUT_DIR"
echo "Fichiers clés:"
echo " - $OUT_DIR/build.json"
echo " - $OUT_DIR/urls.txt"
echo " - $OUT_DIR/eas_xcode_build.txt"
echo " - $OUT_DIR/errors_top.txt"
echo " - $OUT_DIR/tail_200.txt"
