import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

const OWNER = "delishafrica";
const SLUG = "merchant";
const EAS_PROJECT_ID = "292e5d9e-9dbe-4dfb-baf7-ed80cf2e2bbc";

export default ({ config }: ConfigContext): ExpoConfig => {
  const base: any = (appJson as any).expo ?? (appJson as any);

  const mergedExtra = {
    ...(base.extra ?? {}),
    ...(config.extra ?? {}),
    eas: {
      ...(((base.extra ?? {}) as any).eas ?? {}),
      ...(((config.extra ?? {}) as any).eas ?? {}),
      projectId: EAS_PROJECT_ID,
    },
  };

  return {
    ...base,
    ...config,
    owner: OWNER,
    slug: SLUG,
    name: (config.name ?? base.name ?? "DelishAfrica Merchant") as any,
    extra: mergedExtra,
  };
};

// injected by tonton_fix_eas_ids_slugs
export const __EAS_PROJECT_ID__ = "ac87e7fa-1e43-4baa-813e-6174797314a1";
