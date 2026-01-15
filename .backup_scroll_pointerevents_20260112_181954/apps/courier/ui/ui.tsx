import React from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";

type ScreenProps = {
  children: React.ReactNode;
  /** true = scroll activé partout (par défaut) */
  scroll?: boolean;
  /** style du SafeArea wrapper */
  style?: StyleProp<ViewStyle>;
  /** style du contenu interne (scroll content ou view content) */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Screen universel DelishAfrica
 * - scroll=true par défaut (corrige les écrans figés)
 * - padding safe haut/bas
 * - contentContainerStyle = grow (permet scroll même si contenu court)
 */
export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
}: ScreenProps) {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, style]} pointerEvents="auto">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, style]} pointerEvents="auto">
      <View style={[styles.viewContent, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070A0F" },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  viewContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  h1: { fontSize: 40, fontWeight: "900", color: "#F4F7FF", letterSpacing: -0.5 },
  p: { fontSize: 16, color: "#B7C0D6", lineHeight: 22 },
});
