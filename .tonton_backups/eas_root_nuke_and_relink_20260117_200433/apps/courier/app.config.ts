import type { ExpoConfig, ConfigContext } from "expo/config";
import appJson from "./app.json";

const OWNER = "delishafrica";
const SLUG = "courier";
const EAS_PROJECT_ID = "dae37d7c-369e-436c-a4d1-ba62bf8cbc6f";

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
