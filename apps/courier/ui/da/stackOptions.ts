import { Platform, Text, TextInput } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

let applied: Record<string, boolean> = {};

export function applyDADefaults(app: DAApp){
if (applied[app]) return;
applied[app] = true;

const t = getDATheme(app);
const AnyText = Text as any;
const AnyTextInput = TextInput as any;

// Global Text defaults (best-effort): colors + base size + font
AnyText.defaultProps = AnyText.defaultProps ?? {};
const prevTextStyle = (AnyText.defaultProps as any).style;
(AnyText.defaultProps as any).style = [
{ color: t.colors.text, fontSize: t.type.body, fontFamily: t.font.regular, lineHeight: Math.round(t.type.body * t.line.normal) },
prevTextStyle,
];

AnyTextInput.defaultProps = AnyTextInput.defaultProps ?? {};
const prevInputStyle = (AnyTextInput.defaultProps as any).style;
(AnyTextInput.defaultProps as any).style = [
{ color: t.colors.text, fontSize: t.type.body, fontFamily: t.font.regular },
prevInputStyle,
];
(AnyTextInput.defaultProps as any).placeholderTextColor = (AnyTextInput.defaultProps as any).placeholderTextColor ?? t.colors.muted;
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
