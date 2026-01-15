#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="/opt/delishafrica/monorepo/docker-compose.yml"
WDIR="/opt/delishafrica/monorepo"
SERVICE_NAME="api"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root."
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: compose file not found: $COMPOSE_FILE"
  exit 2
fi

# Choose compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose not available (docker compose / docker-compose)."
  exit 3
fi

echo "== Patch compose port 3010 -> localhost (safe) =="
echo "file   : $COMPOSE_FILE"
echo "service: $SERVICE_NAME"
echo

TS="$(date +%Y%m%d_%H%M%S)"
BAK="${COMPOSE_FILE}.bak.${TS}"
cp -a "$COMPOSE_FILE" "$BAK"
echo "backup : $BAK"
echo

# Detect immutable flag
HAD_IMMUTABLE="0"
LSATTR_OUT=""
if command -v lsattr >/dev/null 2>&1; then
  LSATTR_OUT="$(lsattr -d "$COMPOSE_FILE" 2>/dev/null || true)"
  # Format: ----i--------e-- file
  if echo "$LSATTR_OUT" | awk '{print $1}' | grep -q 'i'; then
    HAD_IMMUTABLE="1"
  fi
fi

echo "== Writable check (before) =="
ls -l "$COMPOSE_FILE" || true
echo "lsattr: ${LSATTR_OUT:-<lsattr not available>}"
echo

# Try to unlock if needed
if [[ ! -w "$COMPOSE_FILE" ]]; then
  echo "File is not writable. Attempting unlock..."
  if [[ "$HAD_IMMUTABLE" == "1" ]]; then
    if command -v chattr >/dev/null 2>&1; then
      echo "-> removing immutable flag (chattr -i)"
      chattr -i "$COMPOSE_FILE" || true
    else
      echo "WARN: chattr not found; cannot remove immutable flag automatically."
    fi
  fi
  echo "-> chmod u+w"
  chmod u+w "$COMPOSE_FILE" || true
fi

# If still not writable, check if filesystem is read-only
if [[ ! -w "$COMPOSE_FILE" ]]; then
  echo
  echo "ERROR: still not writable: $COMPOSE_FILE"
  echo "Checking mount options..."
  if command -v findmnt >/dev/null 2>&1; then
    MP="$(findmnt -no TARGET --first-only "$COMPOSE_FILE" 2>/dev/null || true)"
    OPTS="$(findmnt -no OPTIONS --first-only "$COMPOSE_FILE" 2>/dev/null || true)"
    echo "mountpoint: ${MP:-<unknown>}"
    echo "options   : ${OPTS:-<unknown>}"
    if echo "$OPTS" | grep -q '\bro\b'; then
      echo
      echo "Filesystem is mounted read-only (ro). You must remount rw, e.g.:"
      echo "  mount -o remount,rw \"$MP\""
    fi
  else
    mount | head -n 5 || true
    echo "findmnt not available; cannot auto-detect mountpoint/options."
  fi
  exit 10
fi

echo
echo "== Apply patch (3010:3010 -> 127.0.0.1:3010:3010) =="
TMP="/tmp/docker-compose.yml.${TS}.tmp"

python3 - <<'PY' > "$TMP"
import re, pathlib
path = pathlib.Path("/opt/delishafrica/monorepo/docker-compose.yml")
txt = path.read_text()

# Replace only mapping tokens that are exactly 3010:3010 (quoted or not)
def repl(m):
  q = m.group(1) or ""
  return f'{q}127.0.0.1:3010:3010{q}'

new = re.sub(r'(["\']?)3010:3010\1', repl, txt)

print(new, end="")
PY

# Only overwrite if changed
if cmp -s "$COMPOSE_FILE" "$TMP"; then
  echo "NOTE: no change (already patched)."
  rm -f "$TMP"
else
  cat "$TMP" > "$COMPOSE_FILE"
  rm -f "$TMP"
  echo "OK: patched."
fi

echo
echo "== Verify in file =="
grep -nH -E '3010:3010' "$COMPOSE_FILE" || true
echo

echo "== Restart service (no deps) =="
cd "$WDIR"
"${COMPOSE[@]}" -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE_NAME"

echo
echo "== Post-checks =="
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E '(NAME|api|3010)' || true
ss -lntp | egrep '(:3010)\b' || true
echo "-- local health (docker) --"
curl -sS http://127.0.0.1:3010/health || true
echo "-- tunnel health --"
curl -sS https://api.delishafrica.me/health || true
echo

# Re-lock immutable if it was set before
if [[ "$HAD_IMMUTABLE" == "1" ]]; then
  if command -v chattr >/dev/null 2>&1; then
    echo "== Re-lock immutable (chattr +i) =="
    chattr +i "$COMPOSE_FILE" || true
    lsattr -d "$COMPOSE_FILE" || true
  else
    echo "WARN: chattr not found; cannot re-apply immutable flag."
  fi
fi

echo
echo "DONE."
