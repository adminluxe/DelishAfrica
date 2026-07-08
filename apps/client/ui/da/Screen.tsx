import React from "react";
import { View, ScrollView, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: DAApp = "client";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  pad?: "none" | "sm" | "md" | "lg";
  app?: DAApp; // optional (defaults to APP)
};

export function Screen({ children, scroll=false, pad="md", app=APP }: Props){
  const t = getDATheme(app);
  const p = pad === "none" ? 0 : pad === "sm" ? t.space.x3 : pad === "lg" ? t.space.x6 : t.space.x4;

  const Inner: any = scroll ? ScrollView : View;
  const innerProps: any = scroll
    ? { contentContainerStyle: { padding: p, paddingBottom: t.space.x7 } }
    : { style: { padding: p } };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.bg0 }]}>
      <StatusBar barStyle={Platform.OS === "ios" ? "light-content" : "light-content"} />
      <View style={[styles.root, { backgroundColor: t.colors.bg0 }]}>
        <Inner {...innerProps}>
          {children}
        </Inner>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  root: { flex: 1 },
});
