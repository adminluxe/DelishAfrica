import React, { useMemo } from "react";
import { router } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import SnowOverlay from "../src/ui/SnowOverlay";

function getApiBase() {
  // Expo env conventions
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "https://api.delishafrica.me/api/v1"
  );
}

export default function ThieypDemoScreen() {
  const API = useMemo(() => getApiBase(), []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bg}>
        <SnowOverlay />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Thieyp</Text>
          <Text style={styles.subtitle}>Démo rapide (Client)</Text>

          <View style={styles.card}>
            <Text style={styles.label}>API</Text>
            <Text style={styles.value} numberOfLines={1}>{API}</Text>

            <View style={styles.hr} />

            <Text style={styles.desc}>
              Objectif : accéder au menu, puis passer sur un flux de commande démo.
            </Text>

            <View style={styles.row}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btn, styles.btnGhost]}
                onPress={() => router.push("/menu")}
              >
                <Text style={[styles.btnText, styles.btnTextGhost]}>Voir menu</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => router.push("/orders-demo")}
              >
                <Text style={styles.btnText}>Commander</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.link}
            onPress={() => router.push("/")}
          >
            <Text style={styles.linkText}>← Retour accueil</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07060A" },
  bg: { flex: 1, backgroundColor: "#07060A" },
  content: { padding: 18, paddingBottom: 28 },
  title: { fontSize: 34, fontWeight: "900", color: "#F6E7FF", letterSpacing: 0.5 },
  subtitle: { marginTop: 6, fontSize: 14, color: "rgba(246,231,255,0.75)" },

  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(180,120,255,0.22)",
  },
  label: { fontSize: 12, color: "rgba(246,231,255,0.65)" },
  value: { marginTop: 4, fontSize: 13, color: "#EEDCFF" },
  hr: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 12 },
  desc: { fontSize: 14, color: "rgba(246,231,255,0.85)", lineHeight: 20 },

  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: "rgba(180,120,255,0.95)" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(180,120,255,0.35)" },
  btnText: { color: "#0B0810", fontWeight: "900" },
  btnTextGhost: { color: "#EEDCFF" },

  link: { marginTop: 14, alignSelf: "flex-start" },
  linkText: { color: "rgba(180,120,255,0.9)", fontWeight: "700" },
});
