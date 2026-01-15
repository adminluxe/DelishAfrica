#!/usr/bin/env bash
set -euo pipefail

WDIR="/opt/delishafrica/monorepo"
COMPOSE_FILE="$WDIR/docker-compose.yml"
SERVICE_NAME="api"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: compose file not found: $COMPOSE_FILE"
  exit 1
fi

# Choose compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose not available (docker compose / docker-compose)."
  exit 2
fi

echo "== Lock API port mapping to localhost =="
echo "compose_file: $COMPOSE_FILE"
echo "service     : $SERVICE_NAME"
echo

# Backup
TS="$(date +%Y%m%d_%H%M%S)"
BAK="${COMPOSE_FILE}.bak.${TS}"
cp -a "$COMPOSE_FILE" "$BAK"
echo "backup: $BAK"
echo

# Patch (target ONLY lines that expose 3010:3010)
python3 - <<'PY'
import re, sys, pathlib
path = pathlib.Path("/opt/delishafrica/monorepo/docker-compose.yml")
txt = path.read_text()

def repl_line(m):
    line = m.group(0)
    # If already localhost-bound, keep
    if "127.0.0.1:3010:3010" in line:
        return line
    # Preserve quote style if present
    quote = '"' if '"' in line else ("'" if "'" in line else "")
    new_map = f"{quote}127.0.0.1:3010:3010{quote}"
    # Replace only the mapping token
    line2 = re.sub(r'(["\']?)3010:3010\1', new_map, line)
    return line2

pattern = re.compile(r'^[ \t-]*-.*(["\']?)3010:3010\1.*$', re.M)
new = pattern.sub(repl_line, txt)

if new == txt:
    print("NOTE: no change made (pattern not found or already patched).")
else:
    path.write_text(new)
    print("OK: compose patched.")
PY

echo
echo "== Verify mapping line(s) =="
grep -nH -E '3010:3010' "$COMPOSE_FILE" || true
echo

echo "== Restart service (no deps) =="
cd "$WDIR"
"${COMPOSE[@]}" -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE_NAME"

echo
echo "== Post-checks =="
echo "-- docker ps (ports) --"
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E '(NAME|api|3010)' || true
echo
echo "-- ss listening --"
ss -lntp | egrep '(:3010)\b' || true
echo
echo "-- curl local --"
curl -sS http://127.0.0.1:3010/health || true
echo
echo "-- curl via nginx/tunnel --"
curl -sS https://api.delishafrica.me/health || true
echo
echo "DONE."
