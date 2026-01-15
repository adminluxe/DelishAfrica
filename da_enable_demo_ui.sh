#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <API_HTTPS_URL>"
  echo "Example: $0 https://dollars-lively-stanley-endless-loud.trycloudflare.com"
  exit 1
fi

API="$1"
ROOT="/opt/delishafrica/compose"
APPS=("$ROOT/apps/client" "$ROOT/apps/courier" "$ROOT/apps/merchant")
TS="$(date +%Y%m%d-%H%M%S)"

normalize_url() {
  local u="$1"
  u="${u%/}"          # trim trailing slash
  u="${u%/api}"       # if user pasted .../api, keep base clean
  echo "$u"
}
API="$(normalize_url "$API")"

apply_env() {
  local dir="$1"
  local f="$dir/.env"
  [[ -d "$dir" ]] || { echo "❌ Missing dir: $dir"; exit 1; }

  if [[ -f "$f" ]]; then
    cp -a "$f" "$f.bak.$TS"
  fi

  # If file doesn't exist, create it
  touch "$f"

  # Helper: upsert KEY=VALUE
  upsert () {
    local key="$1"
    local val="$2"
    if grep -qE "^${key}=" "$f"; then
      sed -i "s|^${key}=.*|${key}=${val}|g" "$f"
    else
      echo "${key}=${val}" >> "$f"
    fi
  }

  upsert "EXPO_PUBLIC_API_URL" "$API"
  upsert "API_URL" "$API"
  upsert "API_BASE_URL" "$API"

  # Demo UI flag (Expo reads EXPO_PUBLIC_* at runtime)
  upsert "EXPO_PUBLIC_DEMO_UI" "1"
  upsert "DEMO_UI" "1"

  echo "✅ $f -> API=$API + DEMO_UI=1 (backup: $f.bak.$TS)"
}

echo "== Enabling DEMO_UI and aligning API URL =="
echo "API = $API"
for d in "${APPS[@]}"; do
  apply_env "$d"
done

echo "== Restarting tmux stack =="
if [[ -x "$ROOT/tmux_demo_down.sh" ]]; then
  "$ROOT/tmux_demo_down.sh" || true
fi
if [[ -x "$ROOT/tmux_demo_up.sh" ]]; then
  "$ROOT/tmux_demo_up.sh"
else
  echo "⚠️ tmux_demo_up.sh not found/executable. Restart Metro manually."
fi

echo "✅ Done."
