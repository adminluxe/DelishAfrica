import type { ExpoConfig, ConfigContext } from "expo/config";

const OWNER = "delishafrica";
const SLUG = "delishafrica-merchant";
const EAS_PROJECT_ID = "ac87e7fa-1e43-4baa-813e-6174797314a1";

export default ({ config }: ConfigContext): ExpoConfig => {
  const extra: any = config.extra ?? {};

  return {
    ...config,
    owner: OWNER,
    slug: SLUG,
    name: config.name ?? "DelishAfrica Merchant",
    extra: {
      ...extra,
      eas: {
        ...(extra.eas ?? {}),
        projectId: EAS_PROJECT_ID,
      },
    },
  };
};
