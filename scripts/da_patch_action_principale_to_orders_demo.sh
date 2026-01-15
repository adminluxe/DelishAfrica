#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP_DIR="$ROOT/backups/da_patch_action_principale_to_orders_demo_$(date +%Y%m%d_%H%M%S)"
DRY_RUN="true"

if [[ "${1:-}" == "--apply" ]]; then DRY_RUN="false"; fi

mkdir -p "$BACKUP_DIR"

targets=(
  "$ROOT/apps/client/app/index.tsx"
  "$ROOT/apps/courier/app/index.tsx"
  "$ROOT/apps/merchant/app/index.tsx"
)

echo "[da-patch] DRY_RUN=$DRY_RUN"
echo "[da-patch] backups -> $BACKUP_DIR"
echo

patch_file () {
  local f="$1"
  [[ -f "$f" ]] || { echo "[da-patch] SKIP missing: $f"; return; }

  echo "[da-patch] FILE: $f"
  cp -a "$f" "$BACKUP_DIR/$(echo "$f" | sed 's#/#__#g')"

  local before
  before="$(cat "$f")"

  # 1) Replace ONLY the no-op handler on the specific button title line
  # Pattern: Button title="Action principale (démo)" ... onPress={() => {}} ...
  # We only patch if we find exactly a noop "{}" handler.
  local after="$before"
  after="$(printf "%s" "$after" | perl -0777 -pe '
    s/(title\s*=\s*["'\'']Action principale\s*\(démo\)["'\''][^>\n]*?onPress\s*=\s*\(\s*\)\s*=>\s*)\{\s*\}/$1router.push("\/orders-demo")/g
  ')"

  # If nothing changed, do nothing.
  if [[ "$after" == "$before" ]]; then
    echo "  - no change (pattern not found or already patched)"
    echo
    return
  fi

  # 2) Ensure router import exists
  # Accept both: import { Stack } from "expo-router" OR import { Stack, ... } from "expo-router"
  if ! printf "%s" "$after" | grep -qE 'import\s+\{\s*[^}]*\brouter\b[^}]*\}\s+from\s+["'\'']expo-router["'\'']'; then
    # Add router into existing expo-router import if present
    if printf "%s" "$after" | grep -qE 'import\s+\{\s*[^}]*\}\s+from\s+["'\'']expo-router["'\'']'; then
      after="$(printf "%s" "$after" | perl -0777 -pe '
        s/import\s+\{\s*([^}]*)\}\s+from\s+["'\'']expo-router["'\''];/import { $1, router } from "expo-router";/s
        unless $& =~ /\brouter\b/;
      ')"
    else
      # Otherwise inject a new import at top (after first import line)
      after="$(printf "%s" "$after" | awk '
        BEGIN{done=0}
        NR==1 {print; next}
        /^[[:space:]]*import[[:space:]]/ && done==0 {print; next}
        done==0 {print "import { router } from \"expo-router\";"; print ""; done=1}
        {print}
      ')"
    fi
  fi

  if [[ "$DRY_RUN" == "false" ]]; then
    printf "%s" "$after" > "$f"
    echo "  - patched onPress -> router.push(\"/orders-demo\")"
    echo "  - ensured router import"
  else
    echo "  - would patch onPress -> router.push(\"/orders-demo\")"
    echo "  - would ensure router import"
  fi

  echo
}

for f in "${targets[@]}"; do
  patch_file "$f"
done

echo "[da-patch] Done."
echo "[da-patch] Rollback: cp $BACKUP_DIR/<file> <original>"
