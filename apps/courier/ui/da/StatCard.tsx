import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";
import { GlassCard } from "./GlassCard";

const APP: DAApp = "courier";

export function StatCard(props: {
  title: string;
  value: string;
  hint?: string;
  rightPill?: React.ReactNode;
  app?: DAApp;
}){
  const app = props.app ?? APP;
  const t = getDATheme(app);

  return (
    <GlassCard app={app}>
      <View style={{ gap: t.space.x2 }}>
        <View style={styles.row}>
          <Text style={{ color: t.colors.muted, fontSize: 13, fontWeight: "700" }}>{props.title}</Text>
          {props.rightPill ? <View>{props.rightPill}</View> : null}
        </View>
        <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: "900" }}>{props.value}</Text>
        {props.hint ? (
          <Text style={{ color: t.colors.text2, fontSize: 14, fontWeight: "500", opacity: 0.9 }}>{props.hint}</Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
