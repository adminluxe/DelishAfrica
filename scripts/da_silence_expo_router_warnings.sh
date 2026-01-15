#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/router_warnings_silence_$TS"
mkdir -p "$BK"

add_noop_default() {
  local f="$1"
  # si un export default existe déjà, on ne touche pas
  if rg -q --no-messages '^\s*export\s+default\b' "$f"; then
    return 0
  fi

  cat >> "$f" <<'NOOP'

/**
 * Added automatically to silence Expo Router warnings for non-route modules kept under app/.
 * Safe: returns null, so even if navigated accidentally, it renders nothing.
 */
export default function __expo_router_noop_route__() { return null; }
NOOP
}

for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app/app"
  for d in "_ui" "_components"; do
    src="$base/$d"
    if [[ -d "$src" ]]; then
      mkdir -p "$BK/$app"
      cp -a "$src" "$BK/$app/" || true

      # patch seulement les fichiers de code
      while IFS= read -r -d '' f; do
        add_noop_default "$f"
      done < <(find "$src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0)
    fi
  done
done

echo "OK: noop default export added where missing."
echo "Backup: $BK"
