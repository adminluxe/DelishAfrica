#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

ok(){ echo "✅ $*"; }
warn(){ echo "⚠️  $*" >&2; }
die(){ echo "❌ $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

find_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/apps" && -f "$d/package.json" ]]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

json_set_package_manager_pnpm() {
  local pkg="$1"
  local pnpm_ver="$2"
  node - <<NODE
const fs = require('fs');
const p = ${JSON.stringify(pkg)};
const v = ${JSON.stringify(pnpm_ver)};
const j = JSON.parse(fs.readFileSync(p,'utf8'));
j.packageManager = "pnpm@" + v;
fs.writeFileSync(p, JSON.stringify(j,null,2) + "\n");
NODE
}

html_to_text() {
  local in="$1" out="$2"
  python3 - <<'PY' "$in" "$out"
import sys, html
from html.parser import HTMLParser

inp, outp = sys.argv[1], sys.argv[2]
data = open(inp, 'rb').read().decode('utf-8', errors='replace')

class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.chunks=[]
    def handle_data(self, d):
        d=d.strip()
        if d: self.chunks.append(d)

p=P()
try:
    p.feed(data)
except Exception:
    # fallback ultra simple
    txt = data
else:
    txt = "\n".join(p.chunks)

txt = html.unescape(txt)
open(outp,'w',encoding='utf-8').write(txt + "\n")
PY
}

fix_pnpm_and_lockfiles() {
  local root="$1"
  local ts; ts="$(date +%Y%m%d_%H%M%S)"
  local backup="$root/.tonton_backups/eas_rescue_${ts}"
  mkdir -p "$backup"

  ok "Root: $root"
  ok "Backup: $backup"

  # 1) check pnpm lock exists
  if [[ ! -f "$root/pnpm-lock.yaml" ]]; then
    warn "pnpm-lock.yaml introuvable au root -> EAS risque de tomber sur Yarn/NPM"
  else
    ok "pnpm-lock.yaml présent"
  fi

  # 2) move conflicting lockfiles (safe: move to backup)
  mapfile -t locks < <(find "$root" -maxdepth 4 -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) 2>/dev/null || true)
  if (( ${#locks[@]} )); then
    warn "Lockfiles conflictuels détectés (on les DÉPLACE en backup pour forcer PNPM):"
    for f in "${locks[@]}"; do echo "  - $f"; done
    for f in "${locks[@]}"; do
      mkdir -p "$backup/$(dirname "${f#$root/}")"
      mv -f "$f" "$backup/${f#$root/}"
    done
    ok "Déplacés."
  else
    ok "Aucun yarn.lock / package-lock.json trouvé (bien)."
  fi

  # 3) enforce packageManager = pnpm@X
  if command -v pnpm >/dev/null 2>&1; then
    local pv; pv="$(pnpm -v)"
    json_set_package_manager_pnpm "$root/package.json" "$pv"
    ok "package.json: packageManager => pnpm@$pv"
  else
    warn "pnpm pas dispo dans ce shell -> je ne touche pas packageManager."
  fi

  # 4) verify @delishafrica/ui is local or private
  ok "Scan rapide '@delishafrica/ui'..."
  if command -v rg >/dev/null 2>&1; then
    rg -n "\"@delishafrica/ui\"" "$root" || true
  else
    grep -RIn "\"@delishafrica/ui\"" "$root" 2>/dev/null || true
  fi

  if [[ -f "$root/packages/ui/package.json" ]]; then
    ok "packages/ui/package.json présent"
    node -e "const p='$root/packages/ui/package.json'; const j=require(p); console.log('name=', j.name); console.log('version=', j.version);" || true
  else
    warn "packages/ui/package.json absent -> si @delishafrica/ui est attendu en local, on a un souci de structure."
  fi

  echo
  ok "Fix PNPM terminé."
  echo "➡️  Next (sans cramer des crédits EAS):"
  echo "   1) pnpm -w install"
  echo "   2) (option) eas build:inspect -p ios -s archive -o /tmp/eas_inspect_ios --force"
  echo "   3) puis retenter EAS build quand OK"
}

autopsy_build() {
  local root="$1" app="$2" build_id="$3"
  need eas
  need node
  need curl
  need python3

  local app_dir="$root/apps/$app"
  [[ -d "$app_dir" ]] || die "App inconnue: $app (attendu $root/apps/$app)"

  local ts; ts="$(date +%Y%m%d_%H%M%S)"
  local out="$root/.tonton_reports/eas_autopsy_${app}_${ts}"
  mkdir -p "$out"

  ok "Autopsy EAS"
  ok "App: $app ($app_dir)"
  ok "Build: $build_id"
  ok "Out: $out"

  pushd "$app_dir" >/dev/null

  ok "1) Fetch build.json via eas build:view --json"
  if ! eas build:view "$build_id" --json > "$out/build.json" 2> "$out/build_view.err"; then
    warn "eas build:view a échoué. Voir: $out/build_view.err"
  else
    ok "build.json OK"
  fi

  ok "2) Extract URLs"
  node - <<'NODE' "$out/build.json" "$out/urls.txt"
const fs = require('fs');
const [,,p,out]=process.argv;
let j={};
try{ j=JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ process.exit(0); }
function pick(o, path){
  return path.split('.').reduce((a,k)=>a && a[k]!==undefined ? a[k] : undefined, o);
}
const lines=[];
const xcode = pick(j,'artifacts.xcodeBuildLogsUrl');
const logs = pick(j,'logs.url');
const errMsg = pick(j,'error.message');
const errCode = pick(j,'error.errorCode');
lines.push(`errorCode=${errCode||''}`);
lines.push(`errorMessage=${(errMsg||'').replace(/\n/g,' ')}`);
lines.push(`xcodeBuildLogsUrl=${xcode||''}`);
lines.push(`logsUrl=${logs||''}`);
fs.writeFileSync(out, lines.join('\n')+'\n');
NODE
  ok "urls.txt OK"

  local xcode_url
  xcode_url="$(grep -E '^xcodeBuildLogsUrl=' "$out/urls.txt" | cut -d= -f2- || true)"
  local logs_url
  logs_url="$(grep -E '^logsUrl=' "$out/urls.txt" | cut -d= -f2- || true)"

  echo "— URLs —"
  sed -n '1,50p' "$out/urls.txt" || true

  if [[ -n "${xcode_url:-}" ]]; then
    ok "3) Download xcode logs (si dispo)"
    curl -L --retry 2 --retry-delay 1 -o "$out/eas_xcode_build.html" "$xcode_url" || true

    if grep -q "<Code>NoSuchKey</Code>" "$out/eas_xcode_build.html" 2>/dev/null; then
      warn "Le xcodeBuildLogsUrl renvoie NoSuchKey (log expiré ou absent)."
    else
      ok "4) Convert HTML -> TXT + tail"
      html_to_text "$out/eas_xcode_build.html" "$out/eas_xcode_build.txt"
      tail -n 200 "$out/eas_xcode_build.txt" > "$out/tail_200.txt"
      ok "tail_200: $out/tail_200.txt"
    fi
  else
    warn "Pas de xcodeBuildLogsUrl dans build.json (build probablement mort avant la phase Xcode)."
  fi

  if [[ -n "${logs_url:-}" ]]; then
    warn "Note: logsUrl (portail Expo) peut nécessiter une session/auth, donc curl peut échouer."
    echo "logsUrl=$logs_url" >> "$out/urls.txt"
  fi

  popd >/dev/null
  ok "Autopsy terminé -> $out"
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/tonton_eas_rescue.sh fix
  bash scripts/tonton_eas_rescue.sh autopsy <client|merchant|courier> <BUILD_ID>

Exemples:
  bash scripts/tonton_eas_rescue.sh fix
  bash scripts/tonton_eas_rescue.sh autopsy client 7a887464-76b2-48cd-8f01-dd05d36b4401
EOF
}

main() {
  local cmd="${1:-}"
  local root; root="$(find_root || true)"
  [[ -n "$root" ]] || die "Monorepo root introuvable (attendu un dossier avec ./apps et ./package.json)."

  case "$cmd" in
    fix)
      fix_pnpm_and_lockfiles "$root"
      ;;
    autopsy)
      [[ $# -ge 3 ]] || { usage; exit 2; }
      autopsy_build "$root" "$2" "$3"
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}
main "$@"
