#!/usr/bin/env bash
set -euo pipefail

die(){ echo "❌ $*" >&2; exit 1; }
info(){ echo "ℹ️  $*" >&2; }
ok(){ echo "✅ $*" >&2; }

find_root() {
  local d="${PWD}"
  while [[ "$d" != "/" ]]; do
    if [[ -f "$d/package.json" ]]; then
      echo "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local ts
  ts="$(date +%Y%m%d_%H%M%S)"
  cp -a "$f" "$f.bak.$ts"
  ok "backup: $f.bak.$ts"
}

detect_config_file() {
  local appdir="$1"
  local candidates=(
    "$appdir/app.config.json"
    "$appdir/app.json"
    "$appdir/expo.json"
  )
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      echo "$f"
      return 0
    fi
  done
  echo ""
}

read_effective_config() {
  local appdir="$1"
  ( cd "$appdir" && npx --yes expo config --json ) 2>/dev/null || true
}

scan_one() {
  local name="$1"
  local appdir="$2"

  echo
  echo "==================== $name ===================="
  echo "dir: $appdir"

  if [[ ! -d "$appdir" ]]; then
    echo "MISSING DIR"
    return 0
  fi

  local cfg
  cfg="$(detect_config_file "$appdir")"
  if [[ -n "$cfg" ]]; then
    echo "config_file: $cfg"
  else
    echo "config_file: (none found: app.json / app.config.json / expo.json)"
  fi

  local eff
  eff="$(read_effective_config "$appdir")"
  if [[ -z "$eff" ]]; then
    echo "effective: (expo config failed)"
    return 0
  fi

  node - <<'NODE' <<<"$eff"
const j = JSON.parse(require('fs').readFileSync(0,'utf8'));
const expo = j.expo ?? j;
const owner = expo.owner ?? expo?.extra?.expoClient?.owner ?? null;
const slug  = expo.slug ?? null;
const pid = expo?.extra?.eas?.projectId ?? null;
console.log("effective_owner:", owner ?? "n/a");
console.log("effective_slug :", slug ?? "n/a");
console.log("effective_pid  :", pid ?? "MISSING");
NODE

  # essaye de lire le projectId "dans le fichier" si JSON
  if [[ -n "$cfg" ]]; then
    if node -e "process.exit(require('fs').readFileSync('$cfg','utf8').trim().startsWith('{')?0:1)" 2>/dev/null; then
      node - <<'NODE' "$cfg"
const fs = require('fs');
const p = process.argv[1];
const raw = fs.readFileSync(p,'utf8');
let obj;
try { obj = JSON.parse(raw); } catch(e){ console.log("file_pid     :", "(json parse failed)"); process.exit(0); }
const expo = obj.expo ?? obj;
const pid = expo?.extra?.eas?.projectId ?? null;
const owner = expo?.owner ?? null;
const slug  = expo?.slug ?? null;
console.log("file_owner   :", owner ?? "n/a");
console.log("file_slug    :", slug ?? "n/a");
console.log("file_pid     :", pid ?? "MISSING");
NODE
    else
      echo "file_pid     : (non-JSON config file)"
    fi
  fi

  echo "dashboard_hint: compare 'effective_pid' avec Expo Dashboard > Project > Settings > Project ID"
}

set_one() {
  local name="$1"
  local appdir="$2"
  local pid="$3"
  local owner="${4:-}"
  local slug="${5:-}"

  [[ -n "$pid" ]] || die "set: missing PROJECT_ID for $name"
  [[ -d "$appdir" ]] || die "set: dir not found: $appdir"

  local cfg
  cfg="$(detect_config_file "$appdir")"
  [[ -n "$cfg" ]] || die "set: no JSON config file found in $appdir (need app.json/app.config.json/expo.json)"

  # refuse non-JSON
  node -e "process.exit(require('fs').readFileSync('$cfg','utf8').trim().startsWith('{')?0:1)" \
    || die "set: config file is not JSON: $cfg (script patches JSON only)"

  backup_file "$cfg"

  OWNER="$owner" SLUG="$slug" PID="$pid" node - <<'NODE' "$cfg"
const fs = require('fs');
const p = process.argv[1];
const owner = process.env.OWNER || "";
const slug  = process.env.SLUG  || "";
const pid   = process.env.PID;

const raw = fs.readFileSync(p,'utf8');
const obj = JSON.parse(raw);

const hasExpoKey = !!obj.expo;
const expo = hasExpoKey ? obj.expo : obj;

expo.extra = expo.extra || {};
expo.extra.eas = expo.extra.eas || {};
expo.extra.eas.projectId = pid;

if (owner) expo.owner = owner;
if (slug)  expo.slug  = slug;

if (hasExpoKey) obj.expo = expo;

fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", 'utf8');
NODE

  ok "patched $name: set extra.eas.projectId=$pid"
  if [[ -n "$owner" ]]; then ok "patched $name: set owner=$owner"; fi
  if [[ -n "$slug" ]]; then ok "patched $name: set slug=$slug"; fi
}

usage() {
  cat <<'EOF'
tonton_expo_relink.sh - scan + relink Expo/EAS projectId for client/merchant/courier

Usage:
  bash scripts/tonton_expo_relink.sh scan
  bash scripts/tonton_expo_relink.sh set <app> <PROJECT_ID> [owner] [slug]

Examples:
  bash scripts/tonton_expo_relink.sh scan
  bash scripts/tonton_expo_relink.sh set client  de3e6023-... delishafrica delishafrica-client
  bash scripts/tonton_expo_relink.sh set merchant 292e5d9e-... delishafrica delishafrica-merchant
  bash scripts/tonton_expo_relink.sh set courier  dae37d7c-... delishafrica delishafrica-courier
EOF
}

main() {
  local cmd="${1:-}"
  local ROOT
  ROOT="$(find_root || true)"
  [[ -n "$ROOT" ]] || die "Monorepo root introuvable. Lance depuis /opt/delishafrica/monorepo (ou un sous-dossier)."

  local client="$ROOT/apps/client"
  local merchant="$ROOT/apps/merchant"
  local courier="$ROOT/apps/courier"

  case "$cmd" in
    scan)
      scan_one "client" "$client"
      scan_one "merchant" "$merchant"
      scan_one "courier" "$courier"
      ;;
    set)
      local app="${2:-}"
      local pid="${3:-}"
      local owner="${4:-}"
      local slug="${5:-}"

      case "$app" in
        client)   set_one "client"   "$client"   "$pid" "$owner" "$slug" ;;
        merchant) set_one "merchant" "$merchant" "$pid" "$owner" "$slug" ;;
        courier)  set_one "courier"  "$courier"  "$pid" "$owner" "$slug" ;;
        *) die "set: app must be one of: client|merchant|courier" ;;
      esac

      echo
      ok "Re-scan after patch:"
      scan_one "$app" "$ROOT/apps/$app"
      ;;
    ""|help|-h|--help)
      usage
      ;;
    *)
      die "Unknown command: $cmd (use: scan | set)"
      ;;
  esac
}

main "$@"
