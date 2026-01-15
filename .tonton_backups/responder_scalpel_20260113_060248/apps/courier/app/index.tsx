import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";

export default function ScrollProbe() {
  // Pure RN ScrollView (no reanimated / no wrappers)
  const items = Array.from({ length: 120 }).map((_, i) => i + 1);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View pointerEvents="none" style={styles.badgeWrap}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SCROLL PROBE (RESPONDER)</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>If this scrolls ✅</Text>
        <Text style={styles.p}>
          Alors le bloqueur est dans l’écran original (TouchableWithoutFeedback / Pressable full-flex / GestureDetector / responder props).
        </Text>

        {items.map((n) => (
          <View key={String(n)} style={styles.row}>
            <Text style={styles.rowText}>Row {n}</Text>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  badgeWrap: { position: "absolute", top: 12, left: 12, zIndex: 9999 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  badgeText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "800" },
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  h1: { fontSize: 18, fontWeight: "800", marginBottom: 6, color: "white" },
  p: { fontSize: 13, opacity: 0.9, color: "white", marginBottom: 10 },
  row: { height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", justifyContent: "center", paddingHorizontal: 12 },
  rowText: { color: "rgba(255,255,255,0.92)", fontWeight: "600" },
});
