#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
set +H 2>/dev/null || true   # désactive l'history expansion (les URLs ont parfois des !)

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
warn(){ echo "⚠️  $*"; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

find_root(){
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/apps" && -f "$d/package.json" ]]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

usage(){
  cat <<'EOF'
tonton_eas_doctor.sh — EAS build doctor (pnpm/workspaces/lockfiles) + autopsy logs

Usage:
  tonton_eas_doctor.sh scan
  tonton_eas_doctor.sh fix
  tonton_eas_doctor.sh autopsy <client|merchant|courier> [--latest | <BUILD_ID>]

Exemples:
  bash scripts/tonton_eas_doctor.sh fix
  bash scripts/tonton_eas_doctor.sh autopsy client --latest
  bash scripts/tonton_eas_doctor.sh autopsy client 45b1c11f-9642-46e4-a60b-44c88873a5a4
EOF
}

ROOT="$(find_root || true)"
[[ -n "${ROOT:-}" ]] || die "Monorepo root introuvable. Lance-moi depuis /opt/delishafrica/monorepo (ou un sous-dossier)."

TS="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="$ROOT/.tonton_reports/eas_doctor_${TS}"
mkdir -p "$REPORT_DIR"

scan_lockfiles(){
  echo "== Scan lockfiles ==" | tee "$REPORT_DIR/scan.txt"
  find "$ROOT" -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) \
    | sed "s|^$ROOT/||" \
    | tee -a "$REPORT_DIR/scan.txt" || true

  echo "" | tee -a "$REPORT_DIR/scan.txt"
  echo "== Root locks ==" | tee -a "$REPORT_DIR/scan.txt"
  ls -la "$ROOT" | egrep "pnpm-lock\.yaml|yarn\.lock|package-lock\.json" | tee -a "$REPORT_DIR/scan.txt" || true
  ok "Rapport: $REPORT_DIR/scan.txt"
}

fix_lockfiles_and_pnpm(){
  need node
  need pnpm

  local BKP="$ROOT/.tonton_backups/eas_doctor_fix_${TS}"
  mkdir -p "$BKP"
  ok "Backup dir: $BKP"

  # 1) déplacer lockfiles parasites
  mapfile -t LOCKS < <(find "$ROOT" -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) || true)
  if (( ${#LOCKS[@]} > 0 )); then
    warn "Lockfiles parasites détectés: ${#LOCKS[@]}"
    for f in "${LOCKS[@]}"; do
      rel="${f#$ROOT/}"
      mkdir -p "$BKP/$(dirname "$rel")"
      mv "$f" "$BKP/$rel"
      echo "$rel" >> "$REPORT_DIR/moved_lockfiles.txt"
    done
    ok "Déplacés -> $BKP (liste: $REPORT_DIR/moved_lockfiles.txt)"
  else
    ok "Aucun yarn.lock / package-lock.json / shrinkwrap trouvé."
  fi

  # 2) sécuriser packageManager + workspaces au root
  PNPMV="$(pnpm -v | tr -d '\r')"
  node - <<'NODE'
const fs = require('fs');
const path = require('path');

const root = process.env.ROOT;
const pnpmv = process.env.PNPMV;
const p = path.join(root, 'package.json');

const raw = fs.readFileSync(p, 'utf8');
const pkg = JSON.parse(raw);

// Force pnpm
pkg.packageManager = `pnpm@${pnpmv}`;

// Ajoute workspaces si absent (utile si EAS retombe sur yarn un jour)
if (!pkg.workspaces) pkg.workspaces = ["apps/*", "packages/*"];

// On garde l'indentation propre
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", 'utf8');
console.log("root package.json patched:", p);
NODE
  ok "package.json root: packageManager=pnpm@${PNPMV} + workspaces ok"

  # 3) vérifier pnpm-lock.yaml
  if [[ ! -f "$ROOT/pnpm-lock.yaml" ]]; then
    warn "pnpm-lock.yaml absent au root. Je génère via pnpm -w install (ça peut prendre un peu)."
    (cd "$ROOT" && pnpm -w install)
    ok "pnpm-lock.yaml généré."
  else
    ok "pnpm-lock.yaml présent au root."
  fi

  cat > "$REPORT_DIR/README.txt" <<EOF
✅ Fix appliqué.
- Lockfiles parasites déplacés: $REPORT_DIR/moved_lockfiles.txt (si existant)
- Root package.json patché: packageManager + workspaces
Prochain step:
  cd $ROOT/apps/client && eas build -p ios --profile preview
Si ça re-casse:
  bash $ROOT/scripts/tonton_eas_doctor.sh autopsy client --latest
EOF

  ok "Rapport: $REPORT_DIR/README.txt"
}

autopsy_build(){
  need eas
  need node
  need curl
  need python3

  local APP="${1:-}"; shift || true
  [[ -n "$APP" ]] || die "autopsy: app manquante (client|merchant|courier)"
  [[ -d "$ROOT/apps/$APP" ]] || die "autopsy: app inconnue: $APP (attendu: $ROOT/apps/$APP)"

  local ARG="${1:---latest}"
  local OUT="$ROOT/.tonton_reports/eas_autopsy_${APP}_${TS}"
  mkdir -p "$OUT"
  ok "Autopsy dir: $OUT"

  pushd "$ROOT/apps/$APP" >/dev/null

  # build id
  local BUILD_ID=""
  if [[ "$ARG" == "--latest" ]]; then
    eas build:list --platform ios --limit 20 --json > "$OUT/build_list.json" 2> "$OUT/build_list.err" \
      || die "eas build:list a échoué (voir $OUT/build_list.err)"
    BUILD_ID="$(node - "$OUT/build_list.json" <<'NODE'
const fs = require('fs');
const p = process.argv[1];
const x = JSON.parse(fs.readFileSync(p,'utf8'));
const arr = Array.isArray(x) ? x : (x.builds || x.items || []);
if (!arr.length) process.exit(2);
arr.sort((a,b)=> new Date(b.createdAt||b.completedAt||0) - new Date(a.createdAt||a.completedAt||0));
const pick = arr.find(b => String(b.status||'').toUpperCase()==='ERRORED') || arr[0];
process.stdout.write(pick.id || pick.buildId || "");
NODE
)" || true
    [[ -n "$BUILD_ID" ]] || die "Impossible de déterminer un build id (voir $OUT/build_list.json)"
  else
    BUILD_ID="$ARG"
  fi
  ok "Build ID: $BUILD_ID"

  # build view
  eas build:view "$BUILD_ID" --json > "$OUT/build.json" 2> "$OUT/build_view.err" \
    || die "eas build:view a échoué (voir $OUT/build_view.err)"

  # extract log url (fresh)
  node - "$OUT/build.json" > "$OUT/urls.txt" <<'NODE'
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.argv[1],'utf8'));

function pick(obj, paths){
  for (const p of paths){
    const parts = p.split('.');
    let cur = obj;
    let ok = true;
    for (const k of parts){
      if (!cur || !(k in cur)) { ok=false; break; }
      cur = cur[k];
    }
    if (ok && typeof cur === 'string' && cur.startsWith('http')) return cur;
  }
  return "";
}

const xcode = pick(j, [
  "artifacts.xcodeBuildLogsUrl",
  "xcodeBuildLogsUrl",
  "artifacts.buildLogsUrl",
  "buildLogsUrl",
  "logsUrl"
]);

const page = pick(j, [
  "buildUrl",
  "buildDetailsPageUrl",
  "url"
]);

console.log("buildPageUrl =>", page || "(unknown)");
console.log("xcodeBuildLogsUrl =>", xcode || "(none)");
NODE

  # download log (if present)
  LOGURL="$(awk '/xcodeBuildLogsUrl =>/ {print $3}' "$OUT/urls.txt" | tr -d '\r')"
  if [[ -n "${LOGURL:-}" && "$LOGURL" != "(none)" ]]; then
    curl -fsSL -L "$LOGURL" -o "$OUT/eas_xcode_build.html" || true
    # Convert HTML -> TXT (robuste)
    python3 - "$OUT/eas_xcode_build.html" "$OUT/eas_xcode_build.txt" <<'PY'
import re, sys, html
src, dst = sys.argv[1], sys.argv[2]
data = open(src,'rb').read().decode('utf-8','ignore')
# si c'est un XML/HTML d'erreur (NoSuchKey), on le garde aussi
text = re.sub(r'(?is)<script.*?>.*?</script>', ' ', data)
text = re.sub(r'(?is)<style.*?>.*?</style>', ' ', text)
text = re.sub(r'(?is)<[^>]+>', ' ', text)
text = html.unescape(text)
text = re.sub(r'[ \t]+', ' ', text)
text = re.sub(r'\n{3,}', '\n\n', text)
open(dst,'w',encoding='utf-8').write(text.strip()+"\n")
PY
    tail -n 200 "$OUT/eas_xcode_build.txt" > "$OUT/tail_200.txt" || true
  else
    warn "Pas de xcodeBuildLogsUrl exploitable dans build.json"
  fi

  # errors highlight
  {
    echo "== QUICK HIGHLIGHTS =="
    echo "Build: $BUILD_ID"
    echo ""
    echo "-- urls.txt --"
    sed -n '1,80p' "$OUT/urls.txt" || true
    echo ""
    echo "-- grep (yarn/npm/pnpm/workspace/ui) --"
    if [[ -f "$OUT/eas_xcode_build.txt" ]]; then
      rg -n "yarn install|pnpm|npm ERR|package-lock|workspace|@delishafrica/ui|Not found|Install dependencies" "$OUT/eas_xcode_build.txt" || true
    else
      echo "(no eas_xcode_build.txt)"
    fi
  } > "$OUT/errors_top.txt" 2>/dev/null || true

  popd >/dev/null
  ok "Fichiers clés:"
  echo "  - $OUT/build.json"
  echo "  - $OUT/urls.txt"
  echo "  - $OUT/eas_xcode_build.txt (si téléchargé)"
  echo "  - $OUT/errors_top.txt"
}

CMD="${1:-}"; shift || true
case "$CMD" in
  scan)    scan_lockfiles ;;
  fix)     export ROOT PNPMV; fix_lockfiles_and_pnpm ;;
  autopsy) autopsy_build "$@" ;;
  *) usage; exit 1 ;;
esac
