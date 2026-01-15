import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Link } from "expo-router";

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill} pointerEvents="none">
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function ClientHome() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>DELISHAFRICA • CLIENT</Text>
        <Text style={styles.h1}>Découvrir.</Text>
        <Text style={styles.sub}>Commander. Suivre.</Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>API</Text>
          <Text style={styles.cardTitle}>https://api.delishafrica.me</Text>
          <Text style={styles.cardMeta}>Status: ok • {Platform.OS === "ios" ? "iOS" : "Android"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>RESTAURANT VEDETTE</Text>
          <Text style={styles.cardBig}>Thieyp</Text>
          <Text style={styles.cardDesc}>
            Le goût authentique, une UX premium — commande rapide et suivi clair.
          </Text>

          <View style={styles.row}>
            <Link href="/orders" asChild>
              <Pressable style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, styles.btnTextDark]}>Commander</Text>
              </Pressable>
            </Link>

            <Link href="/orders" asChild>
              <Pressable style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnText}>Voir menu</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>TIMELINE COMMANDE</Text>

          <View style={styles.stepOn}>
            <View style={styles.dotOn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Commande</Text>
              <Text style={styles.stepDesc}>Créer la commande Thieyp.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Préparation</Text>
              <Text style={styles.stepDesc}>Le restaurant prépare.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Pick-up</Text>
              <Text style={styles.stepDesc}>Le coursier récupère.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Livré</Text>
              <Text style={styles.stepDesc}>Confirmation côté client.</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Pill label="UI premium" />
          <Pill label="Flow" />
          <Pill label="SafeArea OK" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A10" },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 64, paddingBottom: 24 },
  kicker: { color: "#2F63FF", letterSpacing: 4, fontSize: 12, fontWeight: "700" },
  h1: { color: "#F4F7FF", fontSize: 48, fontWeight: "900", marginTop: 10 },
  sub: { color: "#9AA6C5", fontSize: 22, fontWeight: "700", marginTop: 6, marginBottom: 18 },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginTop: 14,
  },
  cardKicker: { color: "rgba(255,255,255,0.35)", letterSpacing: 3, fontSize: 11, fontWeight: "800" },
  cardTitle: { color: "#F4F7FF", fontSize: 22, fontWeight: "900", marginTop: 10 },
  cardMeta: { color: "rgba(255,255,255,0.35)", marginTop: 6, fontWeight: "700" },
  cardBig: { color: "#F4F7FF", fontSize: 44, fontWeight: "900", marginTop: 10 },
  cardDesc: { color: "#9AA6C5", fontSize: 18, fontWeight: "700", marginTop: 8 },

  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: { flex: 1, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#2ED06E" },
  btnGhost: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(0,0,0,0.15)" },
  btnText: { color: "#F4F7FF", fontSize: 18, fontWeight: "900" },
  btnTextDark: { color: "#07110A" },

  stepOn: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(46,208,110,0.06)", borderWidth: 1, borderColor: "rgba(46,208,110,0.18)", marginTop: 12 },
  stepOff:{ flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginTop: 12 },
  dotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2ED06E", marginTop: 4 },
  dotOff:{ width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.16)", marginTop: 4 },
  stepTitle: { color: "#F4F7FF", fontSize: 22, fontWeight: "900" },
  stepDesc: { color: "#9AA6C5", fontSize: 16, fontWeight: "700", marginTop: 2 },

  footerRow: { flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "center" },
  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.03)" },
  pillText: { color: "rgba(255,255,255,0.70)", fontWeight: "800" },
});
