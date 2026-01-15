import 'dotenv/config';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * SAFE dynamic config for EAS/Expo:
 * - Always spread `config` (preserve app.json values)
 * - Force slug to: "client"
 * - Preserve extra.eas.projectId if present, else read from env: EAS_PROJECT_ID_CLIENT
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra: any = config.extra ?? {};
  const eas: any = extra.eas ?? {};

  return {
    ...config,
    slug: "client",
    ios: { ...(config.ios ?? {}) },
    android: { ...(config.android ?? {}) },
    extra: {
      ...extra,
      eas: {
        ...eas,
        projectId: eas.projectId ?? process.env.EAS_PROJECT_ID_CLIENT,
      },
    },
  };
};
