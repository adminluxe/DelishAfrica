#!/usr/bin/env bash
set -euo pipefail

die(){ echo "❌ $*" >&2; exit 1; }
warn(){ echo "⚠️  $*" >&2; }
info(){ echo "ℹ️  $*" >&2; }
ok(){ echo "✅ $*" >&2; }

ts(){ date +%Y%m%d_%H%M%S; }

find_root(){
  local d="${PWD}"
  while [[ "$d" != "/" ]]; do
    if [[ -f "$d/pnpm-workspace.yaml" || -f "$d/package.json" ]]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local b="${f}.bak.$(ts)"
  cp -a "$f" "$b"
  ok "backup: $b"
}

make_writable(){
  local f="$1"
  [[ -e "$f" ]] || return 0
  if [[ ! -w "$f" ]]; then
    chmod u+w "$f" 2>/dev/null || true
  fi
  if [[ ! -w "$f" ]] && command -v lsattr >/dev/null 2>&1; then
    # si immutable, on tente d'enlever le flag i
    if lsattr "$f" 2>/dev/null | grep -q ' i '; then
      warn "fichier immutable détecté: $f (tentative chattr -i)"
      chattr -i "$f" 2>/dev/null || true
    fi
  fi
}

detect_config(){
  local appdir="$1"
  local candidates=(
    "$appdir/app.json"
    "$appdir/app.config.json"
    "$appdir/expo.json"
  )
  local f
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      echo "$f"; return 0
    fi
  done
  echo ""
}

read_appjson(){
  local file="$1"
  # IMPORTANT: node "-" => argv[1] == "-" ; argv[2] == file
  node - "$file" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const raw = fs.readFileSync(file, "utf8");
const j = JSON.parse(raw);
const expo = j.expo || j;

const out = {
  owner: expo.owner ?? null,
  slug: expo.slug ?? null,
  name: expo.name ?? null,
  iosBundleIdentifier: expo.ios?.bundleIdentifier ?? null,
  androidPackage: expo.android?.package ?? null,
  projectId:
    expo.extra?.eas?.projectId ??
    expo.extra?.eas?.projectID ?? // tolérance typo
    null,
  configFile: file,
};
process.stdout.write(JSON.stringify(out, null, 2));
NODE
}

patch_appjson(){
  local file="$1"
  local owner="${2:-}"
  local slug="${3:-}"
  local projectId="${4:-}"
  [[ -n "$projectId" ]] || die "patch_appjson: projectId manquant"

  make_writable "$file"
  [[ -w "$file" ]] || die "Impossible d'ecrire dans $file (permissions / immutable / fs read-only)"

  backup_file "$file"

  node - "$file" "$owner" "$slug" "$projectId" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const owner = process.argv[3] || "";
const slug = process.argv[4] || "";
const projectId = process.argv[5];

const raw = fs.readFileSync(file, "utf8");
const j = JSON.parse(raw);

const hasExpoKey = !!j.expo;
const expo = hasExpoKey ? j.expo : j;

expo.extra = expo.extra || {};
expo.extra.eas = expo.extra.eas || {};
expo.extra.eas.projectId = projectId;

if (owner) expo.owner = owner;
if (slug) expo.slug = slug;

if (hasExpoKey) j.expo = expo;

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n", "utf8");
NODE
  ok "patched: $file (projectId=$projectId owner=${owner:-<keep>} slug=${slug:-<keep>})"
}

patch_package_manager(){
  local pkg="$1"
  local pmver="$2"
  [[ -f "$pkg" ]] || return 0
  make_writable "$pkg"
  [[ -w "$pkg" ]] || { warn "skip packageManager (no write): $pkg"; return 0; }
  backup_file "$pkg"
  node - "$pkg" "$pmver" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
const pm = process.argv[3];

const raw = fs.readFileSync(f, "utf8");
const j = JSON.parse(raw);

j.packageManager = `pnpm@${pm}`;
fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n", "utf8");
NODE
  ok "packageManager -> pnpm@${pmver} in $pkg"
}

patch_eas_json(){
  local appdir="$1"
  local root="$2"

  local eas_app="$appdir/eas.json"
  local eas_root="$root/eas.json"
  local target=""

  if [[ -f "$eas_app" ]]; then
    target="$eas_app"
  elif [[ -f "$eas_root" ]]; then
    target="$eas_root"
  else
    warn "pas de eas.json trouvé pour $appdir (ni app ni root) -> skip"
    return 0
  fi

  make_writable "$target"
  [[ -w "$target" ]] || die "Impossible d'ecrire dans $target"

  backup_file "$target"

  # installCommand: on installe AU ROOT du monorepo avec pnpm
  # (depuis apps/<app> => root = ../..)
  node - "$target" <<'NODE'
const fs = require("fs");
const f = process.argv[2];
const raw = fs.readFileSync(f, "utf8");
const j = JSON.parse(raw);

j.build = j.build || {};
for (const [profile, cfg] of Object.entries(j.build)) {
  if (!cfg || typeof cfg !== "object") continue;
  cfg.installCommand = "cd ../.. && corepack enable && pnpm -v && pnpm install --frozen-lockfile";
  j.build[profile] = cfg;
}

fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n", "utf8");
NODE

  ok "patched eas.json installCommand (pnpm@root): $target"
}

clean_lockfiles(){
  local root="$1"
  local out="$root/.tonton_backups/locks_$(ts)"
  mkdir -p "$out"

  local patterns=(
    "yarn.lock"
    "package-lock.json"
    "npm-shrinkwrap.json"
  )

  local moved=0
  local p
  for p in "${patterns[@]}"; do
    if [[ -f "$root/$p" ]]; then
      mv "$root/$p" "$out/" && moved=$((moved+1))
    fi
  done

  # aussi dans apps/*
  local app
  for app in client merchant courier; do
    local d="$root/apps/$app"
    [[ -d "$d" ]] || continue
    for p in "${patterns[@]}"; do
      if [[ -f "$d/$p" ]]; then
        mkdir -p "$out/apps_$app"
        mv "$d/$p" "$out/apps_$app/" && moved=$((moved+1))
      fi
    done
  done

  ok "lockfiles déplacés: $moved -> $out"
}

scan(){
  local root; root="$(find_root)" || die "root introuvable (pnpm-workspace.yaml/package.json)"
  ok "root: $root"
  echo

  local app
  for app in client merchant courier; do
    local appdir="$root/apps/$app"
    echo "===== $app ====="
    if [[ ! -d "$appdir" ]]; then
      warn "dossier manquant: $appdir"
      echo
      continue
    fi

    local cfg; cfg="$(detect_config "$appdir")"
    if [[ -z "$cfg" ]]; then
      warn "pas de app.json/app.config.json/expo.json dans $appdir"
      echo
      continue
    fi

    local meta
    meta="$(read_appjson "$cfg" 2>/dev/null || true)"
    if [[ -z "$meta" ]]; then
      warn "lecture JSON impossible (fichier pas JSON ?) -> $cfg"
      echo
      continue
    fi

    echo "$meta"
    echo
  done

  info "👉 Compare chaque projectId avec Expo Dashboard > Project > Settings > Project ID."
  info "👉 Si 1 seul projectId matche le 'bon' projet, on force les 3 via: set-ids <client> <merchant> <courier> [owner] [slugPrefix]"
}

set_ids(){
  local root; root="$(find_root)" || die "root introuvable"
  local client_id="${1:-}"; local merchant_id="${2:-}"; local courier_id="${3:-}"
  local owner="${4:-delishafrica}"
  local slug_prefix="${5:-delishafrica-}"   # ex: delishafrica-client

  [[ -n "$client_id" && -n "$merchant_id" && -n "$courier_id" ]] || die "usage: set-ids <clientId> <merchantId> <courierId> [owner] [slugPrefix]"

  local app cfg slug id
  for app in client merchant courier; do
    local appdir="$root/apps/$app"
    cfg="$(detect_config "$appdir")"
    [[ -n "$cfg" ]] || die "$app: config introuvable (app.json/app.config.json/expo.json)"
    slug="${slug_prefix}${app}"
    case "$app" in
      client) id="$client_id" ;;
      merchant) id="$merchant_id" ;;
      courier) id="$courier_id" ;;
    esac
    patch_appjson "$cfg" "$owner" "$slug" "$id"
  done

  ok "set-ids OK. Re-scan:"
  scan
}

patch_all(){
  local root; root="$(find_root)" || die "root introuvable"
  local pmver="${1:-9.12.1}"

  ok "Patch packageManager + eas.json (pnpm@root) + clean lockfiles"
  clean_lockfiles "$root"

  patch_package_manager "$root/package.json" "$pmver"
  patch_package_manager "$root/apps/client/package.json" "$pmver"
  patch_package_manager "$root/apps/merchant/package.json" "$pmver"
  patch_package_manager "$root/apps/courier/package.json" "$pmver"

  patch_eas_json "$root/apps/client" "$root"
  patch_eas_json "$root/apps/merchant" "$root"
  patch_eas_json "$root/apps/courier" "$root"

  ok "patch-all terminé."
}

help(){
  cat <<'TXT'
Usage:
  bash scripts/tonton_expo_sync.sh scan
  bash scripts/tonton_expo_sync.sh set-ids <clientProjectId> <merchantProjectId> <courierProjectId> [owner] [slugPrefix]
  bash scripts/tonton_expo_sync.sh patch-all [pnpmVersion]

Notes:
- scan lit app.json/app.config.json/expo.json (JSON only).
- set-ids force extra.eas.projectId + owner + slug.
- patch-all: déplace yarn.lock/package-lock, force packageManager pnpm, et force eas.json installCommand à installer depuis le root du monorepo avec pnpm.
TXT
}

cmd="${1:-help}"
shift || true
case "$cmd" in
  scan) scan ;;
  set-ids) set_ids "$@" ;;
  patch-all) patch_all "$@" ;;
  help|-h|--help) help ;;
  *) die "commande inconnue: $cmd (utilise: help)" ;;
esac
