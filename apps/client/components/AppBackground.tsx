import React from "react";
import { View, StyleSheet } from "react-native";

// Safe background wrapper:
// - background layers NEVER capture touches
// - content is ALWAYS on top
export default function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.bg} pointerEvents="none" />
      <View style={styles.overlay} pointerEvents="none" />
      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.20)" },
  content: { flex: 1, zIndex: 1 },
});
