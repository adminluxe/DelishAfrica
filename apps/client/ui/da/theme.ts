import { Platform } from "react-native";
import { da, type DAApp } from "./tokens";
import { getDAColors } from "./colors";

export type DATheme = {
  app: DAApp;
  colors: ReturnType<typeof getDAColors>;
  space: typeof da.space;
  radius: typeof da.radius;
  type: typeof da.type;
  line: typeof da.line;
  motion: typeof da.motion;
  font: {
    regular: string;
    medium: string;
    semibold: string;
  };
};

export function getDATheme(app: DAApp): DATheme {
  const font = Platform.select({
    ios: { regular: "System", medium: "System", semibold: "System" },
    android: { regular: "sans-serif", medium: "sans-serif-medium", semibold: "sans-serif-medium" },
    default: { regular: "System", medium: "System", semibold: "System" },
  }) as DATheme["font"];

  return {
    app,
    colors: getDAColors(app),
    space: da.space,
    radius: da.radius,
    type: da.type,
    line: da.line,
    motion: da.motion,
    font,
  };
}
