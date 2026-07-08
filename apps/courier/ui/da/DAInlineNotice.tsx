import React from "react";
import { View, Text } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: DAApp = "courier";

type Kind = "info" | "success" | "warn" | "error";

export function DAInlineNotice(props: { kind?: Kind; title: string; body?: string; app?: DAApp }){
  const app = props.app ?? APP;
  const t = getDATheme(app);
  const kind = props.kind ?? "info";

  const map = {
    info:   { bd: t.colors.border, fg: t.colors.text2, bg: t.colors.surface1 },
    success:{ bd: "#1F7A5D", fg: t.colors.success, bg: "#0E2B22" },
    warn:   { bd: "#8A6A1F", fg: t.colors.warn, bg: "#2A210D" },
    error:  { bd: "#7A1F2A", fg: t.colors.error, bg: "#2A0D12" },
  } as const;

  const c = map[kind];

  return (
    <View style={{
      borderWidth: 1,
      borderColor: c.bd,
      backgroundColor: c.bg,
      borderRadius: t.radius.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: t.space.x4,
    }}>
      <Text style={{ color: c.fg, fontWeight: "800" }}>{props.title}</Text>
      {props.body ? <Text style={{ color: t.colors.text2, marginTop: 6, fontWeight: "500", opacity: 0.92 }}>{props.body}</Text> : null}
    </View>
  );
}
