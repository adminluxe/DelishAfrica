#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/inject_eas_project_ids_${TS}"
RP="$ROOT/.tonton_reports/inject_eas_project_ids_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧷 Inject extra.eas.projectId into dynamic app.config.ts"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

# IDs (confirmés par tes logs)
CLIENT_ID="de3e6023-5b7d-400a-8977-8008c096d555"
MERCHANT_ID="292e5d9e-9dbe-4dfb-baf7-ed80cf2e2bbc"
COURIER_ID="dae37d7c-369e-436c-a4d1-ba62bfb8cbf6"

write_cfg () {
  local app="$1"
  local pid="$2"
  local cfg="$ROOT/apps/$app/app.config.ts"

  if [[ ! -f "$cfg" ]]; then
    echo "❌ Missing: $cfg"
    return 1
  fi

  mkdir -p "$BK/apps/$app"
  cp -a "$cfg" "$BK/apps/$app/" || true

  # unlock immutable if needed
  chattr -i "$cfg" 2>/dev/null || true

  cat > "$cfg" <<EOF
import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * SAFE dynamic config:
 * - spreads \`config\` (preserves app.json values)
 * - forces slug
 * - injects EAS projectId (required for stable EAS commands/builds)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra: any = config.extra ?? {};
  const eas: any = extra.eas ?? {};

  return {
    ...config,
    slug: "${app}",
    ios: { ...(config.ios ?? {}) },
    android: { ...(config.android ?? {}) },
    extra: {
      ...extra,
      eas: {
        ...eas,
        projectId: "${pid}",
      },
    },
  };
};
EOF

  echo "✅ Wrote: $cfg (slug=${app}, projectId=${pid})"
}

write_cfg "client"   "$CLIENT_ID"
write_cfg "merchant" "$MERCHANT_ID"
write_cfg "courier"  "$COURIER_ID"

echo
echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo "Rollback: rsync -a \"$BK/\" \"$ROOT/\""
