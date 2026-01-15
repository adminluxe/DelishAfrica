#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP_DIR="$ROOT/backups/da_patch_action_principale_to_orders_demo_v2_$(date +%Y%m%d_%H%M%S)"
DRY_RUN="true"
if [[ "${1:-}" == "--apply" ]]; then DRY_RUN="false"; fi

mkdir -p "$BACKUP_DIR"

targets=(
  "$ROOT/apps/client/app/index.tsx"
  "$ROOT/apps/courier/app/index.tsx"
  "$ROOT/apps/merchant/app/index.tsx"
)

echo "[da-patch-v2] DRY_RUN=$DRY_RUN"
echo "[da-patch-v2] backups -> $BACKUP_DIR"
echo

patch_file () {
  local f="$1"
  [[ -f "$f" ]] || { echo "[da-patch-v2] SKIP missing: $f"; return; }

  echo "[da-patch-v2] FILE: $f"
  cp -a "$f" "$BACKUP_DIR/$(echo "$f" | sed 's#/#__#g')"

  local before after
  before="$(cat "$f")"
  after="$before"

  # Patch ONLY the noop handler on the specific button title
  # Handles BOTH:
  #   onPress={() => {}}
  #   onPress={ () => { } }
  after="$(printf "%s" "$after" | perl -0777 -pe '
    s{
      (title\s*=\s*["'\'']Action\ principale\s*\(démo\)["'\''][^>\n]*?onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*)\{\s*\}(\s*\}\s*)
    }{$1router.push("\/orders-demo")$2}gxs
  ')"

  if [[ "$after" == "$before" ]]; then
    # Already patched?
    if printf "%s" "$before" | grep -q 'router\.push\(\"/orders-demo\"\)'; then
      echo "  - already patched"
    else
      echo "  - no change (pattern not found)"
      echo "    -> check the button line: it might not be a noop or uses a different component/prop"
    fi
    echo
    return
  fi

  # Ensure router import exists
  if ! printf "%s" "$after" | grep -qE 'import\s+\{\s*[^}]*\brouter\b[^}]*\}\s+from\s+["'\'']expo-router["'\'']'; then
    if printf "%s" "$after" | grep -qE 'import\s+\{\s*[^}]*\}\s+from\s+["'\'']expo-router["'\'']'; then
      after="$(printf "%s" "$after" | perl -0777 -pe '
        s/import\s+\{\s*([^}]*)\}\s+from\s+["'\'']expo-router["'\''];/import { $1, router } from "expo-router";/s
        unless $& =~ /\brouter\b/;
      ')"
    else
      # Inject after the first import line
      after="$(printf "%s" "$after" | awk '
        BEGIN{done=0}
        {print}
        done==0 && NR==1 {print "import { router } from \"expo-router\";"; print ""; done=1}
      ')"
    fi
  fi

  if [[ "$DRY_RUN" == "false" ]]; then
    printf "%s" "$after" > "$f"
    echo "  - patched button onPress -> router.push(\"/orders-demo\")"
    echo "  - ensured router import"
  else
    echo "  - would patch button onPress -> router.push(\"/orders-demo\")"
    echo "  - would ensure router import"
  fi

  echo
}

for f in "${targets[@]}"; do
  patch_file "$f"
done

echo "[da-patch-v2] Done."
echo "[da-patch-v2] Rollback: cp $BACKUP_DIR/<file> <original>"

