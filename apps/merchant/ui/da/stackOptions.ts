import { Platform, Text, TextInput } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

let applied: Record<string, boolean> = {};

const AnyText = Text as any;
const AnyTextInput = TextInput as any;

export function applyDADefaults(app: DAApp) {
if (applied[app]) return;
applied[app] = true;

const t = getDATheme(app);

// Global Text defaults (best-effort): colors + base size + font.
AnyText.defaultProps = AnyText.defaultProps ?? {};
const prevTextStyle = AnyText.defaultProps.style;
AnyText.defaultProps.style = [
{
color: t.colors.text,
fontSize: t.type.body,
fontFamily: t.font.regular,
lineHeight: Math.round(t.type.body * t.line.normal),
},
prevTextStyle,
];

AnyTextInput.defaultProps = AnyTextInput.defaultProps ?? {};
const prevInputStyle = AnyTextInput.defaultProps.style;
AnyTextInput.defaultProps.style = [
{
color: t.colors.text,
fontSize: t.type.body,
fontFamily: t.font.regular,
},
prevInputStyle,
];

AnyTextInput.defaultProps.placeholderTextColor =
AnyTextInput.defaultProps.placeholderTextColor ?? t.colors.muted;
}

export function daStackScreenOptions(app: DAApp) {
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
