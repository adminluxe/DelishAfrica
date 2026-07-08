import { Platform, Text, TextInput } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

let applied: Record<string, boolean> = {};

export function applyDADefaults(app: DAApp){
  if (applied[app]) return;
  applied[app] = true;

  const t = getDATheme(app);

  // Global Text defaults (best-effort): colors + base size + font
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  const prevTextStyle = ((Text as any).defaultProps as any).style;
  ((Text as any).defaultProps as any).style = [
    { color: t.colors.text, fontSize: t.type.body, fontFamily: t.font.regular, lineHeight: Math.round(t.type.body * t.line.normal) },
    prevTextStyle,
  ];

  (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
  const prevInputStyle = ((TextInput as any).defaultProps as any).style;
  ((TextInput as any).defaultProps as any).style = [
    { color: t.colors.text, fontSize: t.type.body, fontFamily: t.font.regular },
    prevInputStyle,
  ];
  ((TextInput as any).defaultProps as any).placeholderTextColor = ((TextInput as any).defaultProps as any).placeholderTextColor ?? t.colors.muted;
}

export function daStackScreenOptions(app: DAApp){
  const t = getDATheme(app);
  return {
    headerStyle: { backgroundColor: t.colors.bg0 },
    headerTintColor: t.colors.text,
    headerTitleStyle: { fontFamily: t.font.semibold, fontSize: t.type.body },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: t.colors.bg0 },
    animation: Platform.select({ ios: "default", android: "fade" }),
  } as const;
}
