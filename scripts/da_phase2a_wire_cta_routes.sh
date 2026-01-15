#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup_phase2a_wire_cta_$TS"
mkdir -p "$BACKUP"

echo "== DelishAfrica | Phase 2A | Wire CTA routes (safe) =="
echo "Backup: $BACKUP"
cd "$ROOT"

route_from_file() {
  # $1 = app root, $2 = absolute file path under app/
  local approot="$1"
  local file="$2"

  local rel="${file#$approot/app}"
  rel="${rel%.tsx}"
  rel="${rel%.ts}"
  # remove group segments like /(tabs)
  rel="$(echo "$rel" | sed -E 's#/\\([^/]+\\)##g')"
  # index -> folder root
  rel="$(echo "$rel" | sed -E 's#/index$##')"
  # ensure leading /
  [[ "$rel" =~ ^/ ]] || rel="/$rel"
  echo "$rel"
}

find_best_route() {
  # $1 = app root, then candidates in order
  local approot="$1"; shift
  local appdir="$approot/app"

  if [ ! -d "$appdir" ]; then
    echo "/"
    return 0
  fi

  local c
  for c in "$@"; do
    # exact file match (also allow index inside folder)
    local f=""
    f="$(find "$appdir" -type f \( -name "$c.tsx" -o -name "$c.ts" -o -path "*/$c/index.tsx" -o -path "*/$c/index.ts" \) 2>/dev/null | head -n 1 || true)"
    if [ -n "$f" ]; then
      route_from_file "$approot" "$f"
      return 0
    fi
  done

  # fallback: first available route file (avoid _layout)
  local any=""
  any="$(find "$appdir" -type f \( -name "*.tsx" -o -name "*.ts" \) ! -name "_layout.tsx" ! -name "_layout.ts" 2>/dev/null | head -n 1 || true)"
  if [ -n "$any" ]; then
    route_from_file "$approot" "$any"
    return 0
  fi

  echo "/"
}

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$f" "$BACKUP/$rel"
}

ensure_router_import() {
  local file="$1"
  if ! grep -qE 'from ["'\'']expo-router["'\'']' "$file"; then
    # add after first React import line if possible
    if grep -qE '^import React' "$file"; then
      perl -0777 -i -pe 's/(^import React[^\n]*\n)/$1import { router } from "expo-router";\n/m' "$file"
    else
      # add at top
      perl -0777 -i -pe 's/^/import { router } from "expo-router";\n\n/' "$file"
    fi
  else
    # expo-router import exists; ensure router is imported (router may already be used)
    if ! grep -qE '\{\s*router\s*\}' "$file"; then
      # if there is an import from expo-router, extend it
      perl -0777 -i -pe '
        s/import\s+\{\s*([^}]+)\s*\}\s+from\s+["'\'']expo-router["'\''];/my $x=$1; $x=~s/\s+$//; $x.=" , router"; "import { $x } from \"expo-router\";"/e
      ' "$file" || true

      # if still not present, add a clean one (safe)
      if ! grep -qE '\{\s*router\s*\}\s+from\s+["'\'']expo-router["'\'']' "$file"; then
        perl -0777 -i -pe 's/(^import[^\n]*expo-router[^\n]*\n)/$1import { router } from "expo-router";\n/m' "$file"
      fi
    fi
  fi
}

patch_button_onpress_by_label() {
  # $1 file, $2 label text, $3 route, $4 mode push|replace (default push)
  local file="$1"
  local label="$2"
  local route="$3"
  local mode="${4:-push}"

  # only replace empty onPress={() => {}}
  # Matches: label="X" ... onPress={() => {}}
  perl -0777 -i -pe '
    my $label = quotemeta($ENV{LBL});
    my $route = $ENV{ROUTE};
    my $mode  = $ENV{MODE};
    s/(<Button\b[^>]*\blabel\s*=\s*"'"$label"'"\b[^>]*\bonPress\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}[^>]*>)/do {
        my $x=$1;
        $x =~ s/\bonPress\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/onPress={() => router.'"$mode"'("'"$route"'")}/;
        $x;
      }/gse;
  ' "$file"
}

patch_app() {
  local app="$1"
  local cap="$2"
  local file="$ROOT/apps/$app/ui/screens/SignatureHome${cap}.tsx"

  if [ ! -f "$file" ]; then
    echo "WARN: missing $file (skip)"
    return 0
  fi

  backup_file "$file"
  ensure_router_import "$file"

  local approot="$ROOT/apps/$app"

  # Pick best targets per app
  local ROUTE_ORDERS
  local ROUTE_MISSION
  local ROUTE_MENU

  ROUTE_ORDERS="$(find_best_route "$approot" "orders-demo" "orders" "order" "checkout" "cart")"
  ROUTE_MISSION="$(find_best_route "$approot" "mission" "missions" "mission-demo" "deliveries" "delivery" "orders-demo" "orders")"
  ROUTE_MENU="$(find_best_route "$approot" "menu" "restaurant" "restaurants" "orders-demo" "orders")"

  echo "[$app] routes:"
  echo "  orders:  $ROUTE_ORDERS"
  echo "  mission: $ROUTE_MISSION"
  echo "  menu:    $ROUTE_MENU"

  # Patch known CTA labels
  if [ "$app" = "client" ]; then
    LBL='Commander (démo)' ROUTE="$ROUTE_ORDERS" MODE="push" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE" "push"
    LBL='Voir menu' ROUTE="$ROUTE_MENU" MODE="push" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE" "push"
  elif [ "$app" = "merchant" ]; then
    LBL='Accepter (démo)' ROUTE="$ROUTE_ORDERS" MODE="push" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE" "push"
    LBL='Marquer prêt (démo)' ROUTE="$ROUTE_ORDERS" MODE="push" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE" "push"
  elif [ "$app" = "courier" ]; then
    LBL='Voir mission (démo)' ROUTE="$ROUTE_MISSION" MODE="push" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE" "push"
    # "Terminer" -> on revient au hub (orders si dispo sinon /)
    local ROUTE_DONE
    ROUTE_DONE="$(find_best_route "$approot" "orders-demo" "orders" "home" "index")"
    LBL='Terminer (démo)' ROUTE="$ROUTE_DONE" MODE="replace" patch_button_onpress_by_label "$file" "$LBL" "$ROUTE_DONE" "replace"
  fi

  # Small safety: if we inserted router import twice, keep only one exact line
  # (dedupe exact 'import { router } from "expo-router";')
  awk '
    BEGIN{c=0}
    { if($0=="import { router } from \"expo-router\";"){c++; if(c>1) next} }
    {print}
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

patch_app "client"   "Client"
patch_app "merchant" "Merchant"
patch_app "courier"  "Courier"

echo
echo "== DONE =="
echo "Backups saved at: $BACKUP"
echo "Next: press 'r' in the 3 Metro windows (client/merchant/courier)."
