#!/usr/bin/env bash
set -euo pipefail

fix_one () {
  local envf="$1"
  [ -f "$envf" ] || return 0

  if grep -q '^NEXT_PUBLIC_API_URL=' "$envf"; then
    return 0
  fi

  local v=""
  v="$(grep -E '^EXPO_PUBLIC_API_URL=' "$envf" | tail -n1 | cut -d= -f2- || true)"
  if [ -z "$v" ]; then
    v="$(grep -E '^EXPO_PUBLIC_API_BASE_URL=' "$envf" | tail -n1 | cut -d= -f2- || true)"
  fi

  if [ -n "$v" ]; then
    echo "NEXT_PUBLIC_API_URL=$v" >> "$envf"
    echo "Patched: $envf"
  fi
}

for app in client courier merchant; do
  for f in \
    "/opt/delishafrica/monorepo/apps/${app}/.env" \
    "/opt/delishafrica/monorepo/apps/${app}/.env.local" \
    "/opt/delishafrica/monorepo/apps/${app}/.env.development"
  do
    fix_one "$f"
  done
done

echo "✅ Env aliases done."
