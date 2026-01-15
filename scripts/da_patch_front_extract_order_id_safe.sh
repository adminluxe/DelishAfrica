#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP_DIR="$ROOT/backups/da_patch_front_extract_order_id_safe_$(date +%Y%m%d_%H%M%S)"
DRY_RUN="true"

if [[ "${1:-}" == "--apply" ]]; then DRY_RUN="false"; fi

mkdir -p "$BACKUP_DIR"

targets=(
  "$ROOT/apps/client/app/orders-demo.tsx"
  "$ROOT/apps/courier/app/orders-demo.tsx"
  "$ROOT/apps/merchant/app/orders-demo.tsx"
)

echo "[patch] DRY_RUN=$DRY_RUN"
echo "[patch] backups -> $BACKUP_DIR"
echo

for f in "${targets[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[patch] SKIP (missing) $f"
    continue
  fi

  echo "[patch] FILE $f"
  cp -a "$f" "$BACKUP_DIR/$(basename "$f")"

  content="$(cat "$f")"

  # If helper already present, skip injection.
  if grep -q "function extractOrderId" "$f"; then
    echo "  - extractOrderId() already present"
  else
    # Inject helper after imports block (safe heuristic).
    # We inject right after the last import line.
    # Works for typical Expo Router route files.
    awk '
      BEGIN{inserted=0}
      /^import /{print; lastImport=NR; next}
      {
        if(!inserted && lastImport>0 && NR==lastImport+1){
          print ""
          print "function extractOrderId(json: any): string | null {"
          print "  return ("
          print "    json?.order?.id ??"
          print "    json?.orderId ??"
          print "    json?.id ??"
          print "    null"
          print "  );"
          print "}"
          print ""
          inserted=1
        }
        print
      }
    ' "$f" > "$f.__tmp__"

    if [[ "$DRY_RUN" == "false" ]]; then
      mv "$f.__tmp__" "$f"
      echo "  - injected extractOrderId()"
    else
      rm -f "$f.__tmp__"
      echo "  - would inject extractOrderId()"
    fi
  fi

  # Replace common fragile patterns: orderId extraction from create response
  # Heuristic replacements (safe: only if pattern exists).
  if grep -q "orderId" "$f"; then
    if [[ "$DRY_RUN" == "false" ]]; then
      # Replace: const orderId = json.orderId;  -> const orderId = extractOrderId(json);
      sed -i -E 's/const[[:space:]]+orderId[[:space:]]*=[[:space:]]*json\.orderId[[:space:]]*;/const orderId = extractOrderId(json);/g' "$f"
      sed -i -E 's/let[[:space:]]+orderId[[:space:]]*=[[:space:]]*json\.orderId[[:space:]]*;/let orderId = extractOrderId(json);/g' "$f"
      echo "  - hardened orderId parsing (where matched)"
    else
      echo "  - would harden orderId parsing (where matched)"
    fi
  else
    echo "  - no 'orderId' string found (maybe already clean)"
  fi

  echo
done

echo "[patch] Done."
echo "Rollback: cp $BACKUP_DIR/orders-demo.tsx <target>"
