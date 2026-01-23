#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/unlock_expo_configs_$TS"
mkdir -p "$BACKUP"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

print_hdr() { printf "\n==== %s ====\n" "$*"; }

file_report() {
  local p="$1"
  echo "PATH: $p"
  ls -la "$p" || true
  if need_cmd findmnt; then
    echo "FINDMNT: $(findmnt -no SOURCE,FSTYPE,OPTIONS -T "$p" 2>/dev/null || echo 'n/a')"
  fi
  if need_cmd lsattr; then
    echo -n "LSATTR: "
    lsattr -a "$p" 2>/dev/null || echo "n/a"
  else
    echo "LSATTR: n/a (e2fsprogs missing)"
  fi
}

unlock_immutables() {
  local p="$1"
  if need_cmd chattr; then
    chattr -i "$p" 2>/dev/null || true
  fi
}

backup_if_exists() {
  local p="$1"
  if [ -e "$p" ]; then
    local rel="${p#$ROOT/}"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$p" "$BACKUP/$rel"
  fi
}

print_hdr "TONTON UNLOCK EXPO CONFIGS"
echo "ROOT   : $ROOT"
echo "BACKUP : $BACKUP"

# Sanity
[ -d "$APPS_DIR" ] || { echo "ERROR: missing $APPS_DIR"; exit 1; }

# Targets
TARGETS=(
  "app.config.ts"
  "app.config.base.ts"
  "app.json"
  "eas.json"
  "package.json"
)

for app in client merchant courier; do
  APPDIR="$APPS_DIR/$app"
  print_hdr "APP: $app ($APPDIR)"
  if [ ! -d "$APPDIR" ]; then
    echo "SKIP: dir missing"
    continue
  fi

  # Unlock directory itself (rare but can happen)
  unlock_immutables "$APPDIR"

  for f in "${TARGETS[@]}"; do
    P="$APPDIR/$f"
    if [ -e "$P" ]; then
      backup_if_exists "$P"
      file_report "$P"
      unlock_immutables "$P"
      chmod u+rw "$P" 2>/dev/null || true
    fi
  done
done

print_hdr "POST-CHECK (write-test, non destructive)"
TEST_FILE="$APPS_DIR/client/app.config.base.ts"
if [ -e "$TEST_FILE" ]; then
  echo "#tonton_unlock_ok $TS" >> "$TEST_FILE" || true
  tail -n 2 "$TEST_FILE" || true
else
  echo "NOTE: $TEST_FILE not found, skip write-test."
fi

print_hdr "DONE"
echo "Backup saved at: $BACKUP"
