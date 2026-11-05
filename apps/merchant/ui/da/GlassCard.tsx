// DA_GALA_SILENT_CHROME_V1 - global subtraction pass: visual chrome recedes, decision anchors and operational signals stay intact; static styles only.
// DA_GALA_VELVET_CONTRAST_V1 - focal gravity: dark secondary planes recede while human-decision anchors remain luminous; static styles only.
// DA_GALA_SELECTIVE_FOCUS_V1 - selective optical focus: primary actions stay crisp while secondary material dissolves; static styles only.
// DA_GALA_QUIET_LUXURY_V1 - zero-cost optical rhythm polish: softer hierarchy, quieter edges, fewer decorative signals; static styles only.
// DA_GALA_EDGELESS_CONTINUITY_V1 - last-mile surface polish dissolves legacy spectral leaks and reduces card-edge fatigue; presentation only.
// DA_GALA_DEEP_OSMOSIS_V1 - deep navigation adopts the same emerald/amber living field as the hero surfaces; translucent cards preserve water continuity without changing business logic.
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
      shadowColor: t.colors.accent2,
      shadowOpacity: 0.010,
      shadowRadius: 42,
      shadowOffset: { width: 0, height: 8 },
      elevation: 0,
    }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 0.35, padding: 16 },
});
