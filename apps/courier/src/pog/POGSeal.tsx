import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getPackagerOrigin, makeReceiptId } from "./pogNet";

type Props = {
  title?: string;
};

export default function POGSeal({ title = "POG Seal" }: Props) {
  const origin = getPackagerOrigin();

  const receipt = useMemo(() => makeReceiptId("POG"), []);
  const host = origin ?? "unknown";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.label}>Secure Tailnet session</Text>
      </View>
      <Text style={styles.mono}>Host: {host}</Text>
      <Text style={styles.mono}>Receipt: {receipt}</Text>
      <Text style={styles.hint}>This is the DelishAfrica signature layer (dev-only aperçu route).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "white" },
  mono: { fontFamily: "Menlo", color: "rgba(255,255,255,0.85)", marginTop: 6, fontSize: 12 },
  hint: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 99, backgroundColor: "#6BCB77" },
  label: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
});
