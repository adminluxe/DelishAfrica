#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/fix_app_config_slug_v2_${TS}"
RP="$ROOT/.tonton_reports/fix_app_config_slug_v2_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

apps=("client" "courier" "merchant")

echo "🧷 Fix app.config.ts (dynamic) v2 -> spread config + slug + projectId env"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

for app in "${apps[@]}"; do
  APP_DIR="$ROOT/apps/$app"
  CFG="$APP_DIR/app.config.ts"

  [[ -d "$APP_DIR" ]] || { echo "⏭️ Skip $app (missing dir)"; continue; }

  mkdir -p "$BK/apps/$app"
  [[ -f "$CFG" ]] && cp -a "$CFG" "$BK/apps/$app/" || true
  [[ -f "$APP_DIR/app.json" ]] && cp -a "$APP_DIR/app.json" "$BK/apps/$app/" || true

  # env var name in bash (upper)
  UPPER="$(echo "$app" | tr '[:lower:]' '[:upper:]')"

  cat > "$CFG" <<EOF
import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * SAFE dynamic config for EAS/Expo:
 * - Always spread \`config\` (preserve app.json values)
 * - Force slug to: "${app}"
 * - Preserve extra.eas.projectId if present, else read from env: EAS_PROJECT_ID_${UPPER}
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
        projectId: eas.projectId ?? process.env.EAS_PROJECT_ID_${UPPER},
      },
    },
  };
};
EOF

  echo "✅ Wrote: $CFG (slug=${app}, env=EAS_PROJECT_ID_${UPPER})"
done

echo
echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo "Rollback: rsync -a \"$BK/\" \"$ROOT/\""
