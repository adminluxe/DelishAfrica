import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";

const DemoMissionsScreen: React.FC = () => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Missions démo (courier)</Text>

      <Text style={styles.subtitle}>
        Écran helper. Dans la démo, on utilise surtout l'écran d'accueil pour la
        vraie mission.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Livraison #DEMO-001</Text>
        <Text style={styles.cardLine}>📍 Centre-ville de Bruxelles</Text>
        <Text style={styles.cardLine}>🕒 Prévu dans 15 minutes</Text>
        <Text style={styles.cardStatus}>Statut : en attente d'assignation</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Livraison #DEMO-002</Text>
        <Text style={styles.cardLine}>📍 Quartier Européen</Text>
        <Text style={styles.cardLine}>🕒 Prévu dans 30 minutes</Text>
        <Text style={styles.cardStatus}>Statut : en préparation</Text>
      </View>

      <Text style={styles.footer}>
        Astuce : dans la vraie app, ces missions sont poussées en temps réel
        depuis l'API DelishAfrica.
      </Text>
    </ScrollView>
  );
};

export default DemoMissionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5F5",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 4,
  },
  cardLine: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  cardStatus: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
  },
  footer: {
    marginTop: 16,
    fontSize: 12,
    color: "#9CA3AF",
  },
});
