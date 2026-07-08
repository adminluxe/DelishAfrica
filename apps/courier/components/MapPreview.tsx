import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

type MapPreviewProps = {
  title?: string;
  subtitle?: string;
  from?: string;
  to?: string;
  eta?: string | number;
  distance?: string | number;
  style?: StyleProp<ViewStyle>;
};

export function MapPreview({
  title = "Apercu mission",
  subtitle = "Itinéraire de mission",
  from = "Restaurant Thieyp",
  to = "Client DelishAfrica",
  eta = "12 min",
  distance = "3.4 km",
  style,
}: MapPreviewProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.dotStart} />
        <View style={styles.line} />
        <View style={styles.dotEnd} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.routeBox}>
        <Text style={styles.label}>Depart</Text>
        <Text style={styles.value}>{from}</Text>

        <View style={styles.separator} />

        <Text style={styles.label}>Arrivee</Text>
        <Text style={styles.value}>{to}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{eta}</Text>
        <Text style={styles.meta}>{distance}</Text>
      </View>
    </View>
  );
}

export default MapPreview;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#0A2217",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  dotStart: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#35D07F",
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    backgroundColor: "rgba(53,208,127,0.45)",
  },
  dotEnd: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F7C948",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    marginBottom: 16,
  },
  routeBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  label: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
  },
  separator: {
    height: 1,
    marginVertical: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  meta: {
    color: "#DDFBEA",
    fontSize: 13,
    fontWeight: "800",
  },
});
