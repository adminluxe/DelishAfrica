// DA_GALA_INTERACTION_OSMOSIS_V1 - shared actions inherit each app chroma while deep surfaces breathe more freely; no new timer, dependency or business mutation.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: any = "courier";

type Status = "KYC_OK" | "KYC_PENDING" | "ONLINE" | "OFFLINE" | "MISSION" | "IDLE" | "WARN" | "ERROR";

export function StatusPill({ app: appProp, status, label }: { app?: DAApp; status: Status; label: string; }){
  const app = appProp ?? APP;
  const t = getDATheme(app);

  const primaryAccent = app === "merchant" ? t.colors.accent : t.colors.accent2;

  const map: Record<Status, { bg: string; fg: string; bd: string; }> = {
    KYC_OK:      { bg: t.colors.surface1, fg: t.colors.success, bd: t.colors.success },
    KYC_PENDING: { bg: t.colors.surface1, fg: t.colors.warn,    bd: t.colors.warn },
    ONLINE:      { bg: t.colors.surface1, fg: t.colors.success, bd: t.colors.success },
    OFFLINE:     { bg: t.colors.surface0, fg: t.colors.muted,   bd: t.colors.border },
    MISSION:     { bg: t.colors.surface1, fg: primaryAccent,    bd: primaryAccent },
    IDLE:        { bg: t.colors.surface0, fg: t.colors.text2,   bd: t.colors.border },
    WARN:        { bg: t.colors.surface1, fg: t.colors.warn,    bd: t.colors.warn },
    ERROR:       { bg: t.colors.surface1, fg: t.colors.error,   bd: t.colors.error },
  };

  const c = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.bd }]}>
      <Text style={[styles.txt, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  txt: { fontSize: 13, fontWeight: "600" },
});