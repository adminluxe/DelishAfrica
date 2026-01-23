import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

const OWNER = "delishafrica";
const SLUG = "client";
const EAS_PROJECT_ID = "394e7d6f-559b-4536-81a9-fbc0cdb0c68f";

export default ({ config }: ConfigContext): ExpoConfig => {
  // app.json peut être { expo: {...} } ou directement {...}
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
    name: (config.name ?? base.name ?? "DelishAfrica Client") as any,
    extra: mergedExtra,
  };
};

// injected by tonton_fix_eas_ids_slugs
export const __EAS_PROJECT_ID__ = "394e7d6f-559b-4536-81a9-fbc0cdb0c68f";
