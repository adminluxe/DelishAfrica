import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

// Web-specific route. Native map & GPS are intentionally never imported on web.
// Client iOS/Android continues using maps-live-lab.tsx unchanged.
export default function MapsLiveLabWeb() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Suivi de livraison</Text>
        <Text style={styles.text}>
          Retrouvez votre commande et son statut en temps réel.
          La carte interactive est disponible dans l'application mobile.
        </Text>
        <Pressable onPress={() => router.push("/order-tracking")} style={styles.button}>
          <Text style={styles.buttonText}>Suivre ma commande</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/")} style={styles.link}>
          <Text style={styles.linkText}>Retour à l'accueil</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#081A36" },
  body: { flexGrow: 1, justifyContent: "center", padding: 28 },
  kicker: { color: "#7BD4F7", fontWeight: "700", letterSpacing: 3, marginBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginBottom: 14 },
  text: { color: "#D8E2F2", fontSize: 17, lineHeight: 26, marginBottom: 28 },
  button: { backgroundColor: "#E1B76E", paddingVertical: 18, borderRadius: 18 },
  buttonText: { fontWeight: "700", color: "#10213F", textAlign: "center" },
  link: { paddingTop: 20 },
  linkText: { color: "#D8E2F2", textAlign: "center" },
});
