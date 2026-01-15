#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
UI_DIR="$ROOT/packages/ui"
WS="$ROOT/pnpm-workspace.yaml"

CLIENT="$ROOT/apps/client"
COURIER="$ROOT/apps/courier"
MERCHANT="$ROOT/apps/merchant"

die(){ echo "❌ $*" >&2; exit 1; }
need(){ [ -e "$1" ] || die "Introuvable: $1"; }

backup() {
  local f="$1"
  [ -f "$f" ] || return 0
  cp -a "$f" "${f}.bak.$(date +%Y%m%d-%H%M%S)"
}

ensure_pkg_dep() {
  local pkgjson="$1"
  need "$pkgjson"
  node - <<'NODE' "$pkgjson"
const fs = require("fs");
const p = process.argv[1];
const j = JSON.parse(fs.readFileSync(p,"utf8"));
j.dependencies ||= {};
if (!j.dependencies["@delishafrica/ui"]) j.dependencies["@delishafrica/ui"] = "workspace:*";
fs.writeFileSync(p, JSON.stringify(j,null,2) + "\n");
console.log("✅ dep added in", p);
NODE
}

fix_imports() {
  local f="$1"
  [ -f "$f" ] || return 0
  # Remplace "delishafrica/ui" -> "@delishafrica/ui"
  sed -i 's|"delishafrica/ui"|"@delishafrica/ui"|g' "$f" || true
  sed -i "s|'delishafrica/ui'|'@delishafrica/ui'|g" "$f" || true
}

echo "🧩 Fix UI package resolution — workspace + deps + imports"
need "$ROOT"
need "$CLIENT"
need "$COURIER"
need "$MERCHANT"
need "$UI_DIR/package.json"

echo "1) ✅ Assurer que pnpm-workspace.yaml inclut packages/*"
if [ ! -f "$WS" ]; then
  die "pnpm-workspace.yaml absent à la racine: $WS"
fi

backup "$WS"
if ! grep -qE '^\s*-\s*"?packages/\*"?\s*$' "$WS"; then
  echo "➕ Ajout de packages/* dans pnpm-workspace.yaml"
  # Ajoute sous 'packages:' si existe, sinon append simple
  if grep -qE '^\s*packages:\s*$' "$WS"; then
    awk '
      BEGIN{added=0}
      {print}
      /^\s*packages:\s*$/ && !added { print "  - \"packages/*\""; added=1 }
    ' "$WS" > "$WS.tmp" && mv "$WS.tmp" "$WS"
  else
    cat >> "$WS" <<'YAML'

packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
YAML
  fi
fi

echo "2) ✅ Ajouter la dépendance @delishafrica/ui (workspace:*) dans les 3 apps"
backup "$CLIENT/package.json";  ensure_pkg_dep "$CLIENT/package.json"
backup "$COURIER/package.json";  ensure_pkg_dep "$COURIER/package.json"
backup "$MERCHANT/package.json"; ensure_pkg_dep "$MERCHANT/package.json"

echo "3) ✅ Corriger les imports (delishafrica/ui -> @delishafrica/ui) dans _layout.tsx / index.tsx"
fix_imports "$CLIENT/app/_layout.tsx"
fix_imports "$COURIER/app/_layout.tsx"
fix_imports "$MERCHANT/app/_layout.tsx"

fix_imports "$CLIENT/app/index.tsx"
fix_imports "$COURIER/app/index.tsx"
fix_imports "$MERCHANT/app/index.tsx"

echo "4) 📦 pnpm install (root) pour lier le workspace"
cd "$ROOT"
pnpm -w install

echo "✅ UI package is now resolvable as @delishafrica/ui"
