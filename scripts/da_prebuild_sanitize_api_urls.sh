#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
PROD_BASE="https://api.delishafrica.me/api/v1"

echo "== Prebuild sanitize API URLs =="
echo "ROOT: $ROOT"
echo "PROD: $PROD_BASE"
echo

stamp="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/_diag/prebuild_$stamp"
mkdir -p "$BACKUP_DIR"

backup_file() {
  local f="$1"
  local rel="${f#$ROOT/}"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

patch_file() {
  local f="$1"
  backup_file "$f"
  # replace hardcoded localhost/ip variants -> prod base
  perl -pi -e '
    s#http://127\.0\.0\.1:3010/api/v1#'"$PROD_BASE"'#g;
    s#http://localhost:3010/api/v1#'"$PROD_BASE"'#g;
    s#127\.0\.0\.1:3010#api.delishafrica.me#g;
    s#localhost:3010#api.delishafrica.me#g;
  ' "$f"
  echo "patched: $f"
}

echo "== Targeted patch (demo screens) =="

targets=(
  "$ROOT/apps/merchant/app/demo-thieyp.tsx"
  "$ROOT/apps/courier/app/demo-thieyp.tsx"
)

for f in "${targets[@]}"; do
  if [[ -f "$f" ]]; then
    patch_file "$f"
  else
    echo "skip (missing): $f"
  fi
done

echo
echo "== Clean scan noise (optional) =="
# these folders should never affect build, but we remove obvious needles to avoid confusion
if [[ -d "$ROOT/apps/courier/.backup" ]]; then
  echo "note: .backup exists (not built). leaving it, but you can delete if you want:"
  echo "      rm -rf '$ROOT/apps/courier/.backup'"
fi

echo
echo "== Verify no hardcoded 127.0.0.1:3010 remaining in apps (excluding node_modules) =="
hits="$(grep -R --line-number --exclude-dir node_modules --exclude-dir .git --exclude-dir dist --exclude-dir build \
  -E '127\.0\.0\.1:3010|localhost:3010' "$ROOT/apps" || true)"

if [[ -n "$hits" ]]; then
  echo "WARNING: still found references:"
  echo "$hits"
  echo
  echo "Backup saved at: $BACKUP_DIR"
  exit 4
fi

echo "OK: no hardcoded localhost/ip refs found."
echo "Backup saved at: $BACKUP_DIR"
