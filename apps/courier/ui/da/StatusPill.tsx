import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: any = "courier";

type Status = "KYC_OK" | "KYC_PENDING" | "ONLINE" | "OFFLINE" | "MISSION" | "IDLE" | "WARN" | "ERROR";

export function StatusPill({ app: appProp, status, label }: { app?: DAApp; status: Status; label: string; }){
  const app = appProp ?? APP;
  const t = getDATheme(app);

  const map: Record<Status, { bg: string; fg: string; bd: string; }> = {
    KYC_OK:      { bg: "#0E2B22", fg: t.colors.success, bd: "#1F7A5D" },
    KYC_PENDING: { bg: "#2A210D", fg: t.colors.warn,    bd: "#8A6A1F" },
    ONLINE:      { bg: "#0E2B22", fg: t.colors.success, bd: "#1F7A5D" },
    OFFLINE:     { bg: t.colors.surface1, fg: t.colors.muted, bd: t.colors.border },
    MISSION:     { bg: "#0C1D2A", fg: t.colors.accent2, bd: "#1F4A63" },
    IDLE:        { bg: t.colors.surface1, fg: t.colors.text2, bd: t.colors.border },
    WARN:        { bg: "#2A210D", fg: t.colors.warn,    bd: "#8A6A1F" },
    ERROR:       { bg: "#2A0D12", fg: t.colors.error,   bd: "#7A1F2A" },
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