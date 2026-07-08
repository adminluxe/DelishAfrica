import React from "react";
import { View, StyleSheet } from "react-native";

const OFF =
  process.env.EXPO_PUBLIC_BG_OFF === "1" ||
  process.env.NEXT_PUBLIC_BG_OFF === "1" ||
  process.env.BG_OFF === "1";

// KILLSHOT: never capture touches
export default function SnowOverlay() {
  if (OFF) return null;
  return <View pointerEvents="none" style={styles.layer} />;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
});
