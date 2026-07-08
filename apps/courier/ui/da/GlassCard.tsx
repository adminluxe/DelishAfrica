import React from "react";
import { View, StyleSheet } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

type Props = { app: DAApp; children: React.ReactNode; };

export function GlassCard({ app, children }: Props){
  const t = getDATheme(app);
  return (
    <View style={[styles.card, {
      backgroundColor: t.colors.surface0,
      borderColor: t.colors.border,
      borderRadius: t.radius.xl,
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16 },
});
