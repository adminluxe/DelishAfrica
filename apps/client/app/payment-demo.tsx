import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function PaymentDemoScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.kicker}>DELISHAFRICA</Text>
          <Text style={styles.title}>Paiement sécurisé</Text>
          <Text style={styles.text}>
            La validation bancaire est centralisée dans l’écran de paiement sécurisé.
          </Text>
        </View>

        <Pressable style={styles.primary} onPress={() => router.push("/payment-readiness")}>
          <Text style={styles.primaryText}>Ouvrir la validation bancaire</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.push("/checkout-preflight")}>
          <Text style={styles.secondaryText}>Retour à la validation commande</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.push("/")}>
          <Text style={styles.secondaryText}>Accueil Client</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#06111F" },
  container: { flexGrow: 1, padding: 22, gap: 16, justifyContent: "center" },
  card: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  kicker: {
    color: "#F7C873",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginBottom: 10 },
  text: { color: "rgba(255,255,255,0.78)", fontSize: 15, lineHeight: 22 },
  primary: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: "#F7C873",
    alignItems: "center",
  },
  primaryText: { color: "#06111F", fontSize: 15, fontWeight: "900" },
  secondary: {
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  secondaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
