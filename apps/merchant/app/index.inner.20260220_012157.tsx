import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Link } from "expo-router";
import { Screen, DAHeader, DAFadeIn } from "../ui/da";
export default function MerchantHome() {
  return (
    <Screen>

      <DAHeader title="Dashboard" subtitle="Vue d’ensemble, au millimètre." />
      <DAFadeIn>

    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>DELISHAFRICA • MERCHANT</Text>
        <Text style={styles.h1}>Poste cuisine.</Text>
        <Text style={styles.sub}>Actions rapides. Lisibilité maximale. Zéro stress.</Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>API</Text>
          <Text style={styles.cardTitle}>Connexion DelishAfrica sécurisée</Text>
          <Text style={styles.cardMeta}>Status: ok • {Platform.OS === "ios" ? "iOS" : "Android"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>RESTAURANT CONNECTÉ</Text>
          <Text style={styles.cardBig}>Thieyp</Text>
          <Text style={styles.cardDesc}>Interface pro, claire, premium — la cuisine au contrôle.</Text>

          <View style={styles.row}>
            <Link href="/orders" asChild>
              <Pressable style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, styles.btnTextDark]}>Accepter</Text>
              </Pressable>
            </Link>
            <Link href="/orders" asChild>
              <Pressable style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnText}>Marquer prêt</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>TIMELINE OPÉRATION</Text>

          <View style={styles.stepOn}>
            <View style={styles.dotOn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Réception</Text>
              <Text style={styles.stepDesc}>Commandes entrantes.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Préparation</Text>
              <Text style={styles.stepDesc}>Marquer “Prêt” dès que c’est chaud.</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
      </DAFadeIn>
  
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A10" },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 64, paddingBottom: 24 },
  kicker: { color: "#F29A4A", letterSpacing: 4, fontSize: 12, fontWeight: "900" },
  h1: { color: "#F4F7FF", fontSize: 48, fontWeight: "900", marginTop: 10 },
  sub: { color: "#B39A8A", fontSize: 20, fontWeight: "800", marginTop: 6, marginBottom: 18 },

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
  cardDesc: { color: "#B39A8A", fontSize: 18, fontWeight: "700", marginTop: 8 },

  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: { flex: 1, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#F29A4A" },
  btnGhost: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(0,0,0,0.15)" },
  btnText: { color: "#F4F7FF", fontSize: 18, fontWeight: "900" },
  btnTextDark: { color: "#120A05" },

  stepOn: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(242,154,74,0.06)", borderWidth: 1, borderColor: "rgba(242,154,74,0.18)", marginTop: 12 },
  stepOff:{ flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginTop: 12 },
  dotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#F29A4A", marginTop: 4 },
  dotOff:{ width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.16)", marginTop: 4 },
  stepTitle: { color: "#F4F7FF", fontSize: 22, fontWeight: "900" },
  stepDesc: { color: "#B39A8A", fontSize: 16, fontWeight: "700", marginTop: 2 },
});