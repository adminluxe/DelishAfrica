#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/fix_app_config_slug_${TS}"
RP="$ROOT/.tonton_reports/fix_app_config_slug_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

apps=("client" "courier" "merchant")

echo "🧷 Fix app.config.ts (dynamic) -> spread config + slug simple"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

for app in "${apps[@]}"; do
  APP_DIR="$ROOT/apps/$app"
  CFG="$APP_DIR/app.config.ts"

  if [[ ! -d "$APP_DIR" ]]; then
    echo "⏭️ Skip $app (dir missing): $APP_DIR"
    continue
  fi

  mkdir -p "$BK/apps/$app"
  [[ -f "$CFG" ]] && cp -a "$CFG" "$BK/apps/$app/" || true
  [[ -f "$APP_DIR/app.json" ]] && cp -a "$APP_DIR/app.json" "$BK/apps/$app/" || true

  cat > "$CFG" <<EOF
import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * SAFE dynamic config for EAS/Expo:
 * - Always spread \`config\` (so app.json values are preserved)
 * - Force slug to match the already linked EAS project (client/courier/merchant)
 * - Preserve \`extra\` (incl. extra.eas.projectId) if present
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra: any = config.extra ?? {};
  const eas = extra.eas ?? {};

  return {
    ...config,
    slug: '${app}',

    // keep platform objects if they exist
    ios: { ...(config.ios ?? {}) },
    android: { ...(config.android ?? {}) },

    extra: {
      ...extra,
      eas: {
        ...eas,
        // If projectId is already in app.json, it stays.
        // Otherwise you can inject via env var EAS_PROJECT_ID_${app.toUpperCase()}
        projectId: eas.projectId ?? process.env.EAS_PROJECT_ID_${app.toUpperCase()},
      },
    },
  };
};
EOF

  echo "✅ Wrote: $CFG (slug=${app})"
done

echo
echo "DONE ✅"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "Rollback (1-liner):"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
