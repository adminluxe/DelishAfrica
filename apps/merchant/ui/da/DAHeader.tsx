import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: DAApp = "merchant";

export function DAHeader(props: {
  title: string;
  subtitle?: string;
  app?: DAApp;
}){
  const app = props.app ?? APP;
  const t = getDATheme(app);

  return (
    <View style={{ marginBottom: t.space.x5 }}>
      <View style={[styles.hairline, { backgroundColor: t.colors.accent2, opacity: 0.85 }]} />
      <Text style={[styles.title, { color: t.colors.text, fontSize: t.type.h1, lineHeight: Math.round(t.type.h1 * t.line.tight) }]}>
        {props.title}
      </Text>
      {props.subtitle ? (
        <Text style={[styles.sub, { color: t.colors.text2, marginTop: t.space.x2 }]}>
          {props.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hairline: { width: 44, height: 3, borderRadius: 99, marginBottom: 10 },
  title: { fontWeight: "800" },
  sub: { fontSize: 14, fontWeight: "500", opacity: 0.92 },
});
