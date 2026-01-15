import React from "react";
import { Image, StyleSheet, View } from "react-native";

export function BrandBackground({ children }: { children: React.ReactNode }) {
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Image
        source={require("../assets/branding/DelishAfrica_Minimal_1290x2796.png")}
        style={styles.bg}
        resizeMode="cover"
        blurRadius={18}
      />
      <View pointerEvents="none" style={styles.overlay} />
      <View pointerEvents="box-none" style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  content: { flex: 1 }
});
