#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${DA_ATMOSPHERE_RUNTIME_DIR:-$ROOT/services/api-nest/.runtime/atmosphere}"
MODE="${1:-}"
MINUTES="${2:-30}"

usage() {
  cat <<'EOF'
Usage:
  scripts/da_atmosphere_weather.sh auto
  scripts/da_atmosphere_weather.sh clear [minutes]
  scripts/da_atmosphere_weather.sh cloud [minutes]
  scripts/da_atmosphere_weather.sh mist [minutes]
  scripts/da_atmosphere_weather.sh rain [minutes]
  scripts/da_atmosphere_weather.sh storm [minutes]
  scripts/da_atmosphere_weather.sh snow [minutes]
  scripts/da_atmosphere_weather.sh heat [minutes]

Examples:
  scripts/da_atmosphere_weather.sh rain 20
  scripts/da_atmosphere_weather.sh mist 10
  scripts/da_atmosphere_weather.sh auto
EOF
}

case "$MODE" in
  auto|clear|cloud|mist|rain|storm|snow|heat) ;;
  *) usage; exit 64 ;;
esac

mkdir -p "$RUNTIME_DIR"
OVERRIDE_FILE="$RUNTIME_DIR/override.json"

if [[ "$MODE" == "auto" ]]; then
  rm -f "$OVERRIDE_FILE"
  echo "ATMOSPHERE=auto"
  echo "Override supprimé. Les apps reviennent à la météo réelle du marché."
  exit 0
fi

if ! [[ "$MINUTES" =~ ^[0-9]+$ ]] || (( MINUTES < 1 || MINUTES > 720 )); then
  echo "minutes doit être un entier entre 1 et 720" >&2
  exit 64
fi

UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EXPIRES_AT="$(date -u -d "+${MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ)"
TMP="$OVERRIDE_FILE.$$"

cat > "$TMP" <<EOF
{
  "mode": "$MODE",
  "updatedAt": "$UPDATED_AT",
  "expiresAt": "$EXPIRES_AT"
}
EOF
chmod 600 "$TMP"
mv "$TMP" "$OVERRIDE_FILE"

echo "ATMOSPHERE=$MODE"
echo "EXPIRES_AT=$EXPIRES_AT"
echo "RUNTIME_FILE=$OVERRIDE_FILE"
echo
echo "En développement, les apps relisent l’atmosphère sous ~45s."
echo "En production, le cycle normal est ~10 min ou au retour au premier plan."
