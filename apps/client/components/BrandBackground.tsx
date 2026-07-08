import React from "react";
import { View, StyleSheet } from "react-native";

// Safe brand wrapper: same rule (no touch capture, content on top).
export default function BrandBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.bg} pointerEvents="none" />
      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 1 },
  content: { flex: 1, zIndex: 1 },
});
