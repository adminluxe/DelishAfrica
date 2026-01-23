import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

const OWNER = "delishafrica";
const SLUG = "courier";
const EAS_PROJECT_ID = "5d1b6b85-9e64-4cc2-9cbe-7d698feccc84";

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
    name: (config.name ?? base.name ?? "DelishAfrica Courier") as any,
    extra: mergedExtra,
  };
};

// injected by tonton_fix_eas_ids_slugs
export const __EAS_PROJECT_ID__ = "b6ed6df5-cd75-48ff-99f9-fc5adcaec479";
