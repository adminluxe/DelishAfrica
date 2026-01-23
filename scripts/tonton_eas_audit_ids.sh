#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "merchant" "courier")

OWNER_EXPECT="delishafrica"
declare -A EXPECT_SLUG=(
  ["client"]="delishafrica-client"
  ["merchant"]="delishafrica-merchant"
  ["courier"]="delishafrica-courier"
)
declare -A EXPECT_PID=(
  ["client"]="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
  ["merchant"]="ac87e7fa-1e43-4baa-813e-6174797314a1"
  ["courier"]="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"
)

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; CLR=$'\033[0m'

fail=0
echo "=== DelishAfrica EAS/Expo Audit ==="
echo "ROOT: $ROOT"
echo

for app in "${APPS[@]}"; do
  APP_DIR="$ROOT/apps/$app"
  echo "----- $app -----"
  echo "dir: $APP_DIR"

  if [[ ! -d "$APP_DIR" ]]; then
    echo "${RED}❌ missing directory${CLR}"
    echo
    fail=1
    continue
  fi

  pushd "$APP_DIR" >/dev/null

  # whoami (non bloquant)
  WHOAMI="$(npx -y eas-cli@latest whoami --non-interactive 2>/dev/null || true)"
  if [[ -z "${WHOAMI:-}" ]]; then
    echo "${YEL}⚠️ eas whoami: (not logged in / unavailable)${CLR}"
  else
    echo "eas whoami: $WHOAMI"
    if [[ "$WHOAMI" != "$OWNER_EXPECT" ]]; then
      echo "${YEL}⚠️ EAS account mismatch (expected: $OWNER_EXPECT)${CLR}"
    fi
  fi

  # expo config owner/slug/projectId
  CFG_LINE="$(npx expo config --json 2>/dev/null | node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(0,"utf8")); const pid=c.extra?.eas?.projectId||""; console.log([c.owner||"", c.slug||"", pid].join("|"));' || true)"

  OWNER="${CFG_LINE%%|*}"
  REST="${CFG_LINE#*|}"
  SLUG="${REST%%|*}"
  PID="${REST##*|}"

  echo "expo config: owner=$OWNER slug=$SLUG projectId=$PID"

  exp_slug="${EXPECT_SLUG[$app]}"
  exp_pid="${EXPECT_PID[$app]}"

  if [[ "$OWNER" != "$OWNER_EXPECT" || "$SLUG" != "$exp_slug" || "$PID" != "$exp_pid" ]]; then
    echo "${RED}❌ MISMATCH${CLR}"
    echo "  expected: owner=$OWNER_EXPECT slug=$exp_slug projectId=$exp_pid"
    echo "  hint: check app.config.* / app.json for extra.eas.projectId + slug"
    fail=1
  else
    echo "${GRN}✅ OK${CLR}"
  fi

  # config file hint
  CFG_FILE=""
  for f in app.config.ts app.config.js app.config.mjs app.json; do
    [[ -f "$APP_DIR/$f" ]] && CFG_FILE="$APP_DIR/$f" && break
  done
  [[ -n "$CFG_FILE" ]] && echo "config file: $CFG_FILE"

  popd >/dev/null
  echo
done

if [[ "$fail" -eq 1 ]]; then
  echo "${RED}Audit FAILED: fix mismatches above.${CLR}"
  exit 1
fi

echo "${GRN}Audit PASSED: all 3 apps aligned.${CLR}"
