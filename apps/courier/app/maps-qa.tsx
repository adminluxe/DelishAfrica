import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useJourneyRoute } from "../utils/useJourneyRoute";
import type { JourneyPoint } from "../../../packages/contracts/src/missionJourney";

/** Closed-ring diagnostic. Uses only public Brussels landmarks; never creates
 * an order, reads a customer address, starts a watcher, or shares a location.
 */
const QA = process.env.EXPO_PUBLIC_RELEASE_RING === "ataraxie-ios-qa";
const RAW = process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API = RAW.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW.replace(/\/$/, "") : RAW.replace(/\/$/, "") + "/api/v1";
const ORIGIN: JourneyPoint = { latitude: 50.8466, longitude: 4.3528 };
const DESTINATION: JourneyPoint = { latitude: 50.8949, longitude: 4.3415 };

export default function CourierMapsQaScreen() {
  const map = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const route = useJourneyRoute({
    apiBaseUrl: API, orderId: "HF42-QA-PUBLIC-MAPS", origin: ORIGIN,
    destination: DESTINATION, mode: "BICYCLE", phase: "qa-public-test", enabled: QA,
  });
  useEffect(() => {
    if (!mapReady || !route.route) return;
    const points = route.route.points.filter((_, index) => index % 12 === 0);
    map.current?.fitToCoordinates([ORIGIN, DESTINATION, ...points], {
      edgePadding: { top: 42, bottom: 42, left: 30, right: 30 }, animated: true,
    });
  }, [mapReady, route.route?.computedAtMs]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA® · MAPS</Text>
          <Text style={styles.title}>Vérification itinéraire</Text>
        </View>
      </View>
      {!QA ? <View style={styles.panel}>
        <Text style={styles.subtitle}>Cette vérification est réservée au canal iOS QA fermé.</Text>
      </View> : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>PARCOURS PUBLIC · AUCUNE COMMANDE</Text>
            <Text style={styles.subtitle}>Grand-Place → Atomium, Bruxelles · Vélo</Text>
            <Text style={styles.hint}>Cet essai contrôle le trajet Google et son affichage dans l’app. Il n’utilise ni votre GPS, ni une adresse client, ni le partage de position.</Text>
          </View>
          <View style={styles.mapFrame}>
            <MapView ref={map} style={StyleSheet.absoluteFill}
              initialRegion={{ latitude: 50.8705, longitude: 4.3470, latitudeDelta: 0.085, longitudeDelta: 0.085 }}
              onMapReady={() => setMapReady(true)} accessibilityLabel="Carte de contrôle Maps DelishAfrica">
              <Marker coordinate={ORIGIN} title="Grand-Place" pinColor="#38D898" />
              <Marker coordinate={DESTINATION} title="Atomium" pinColor="#E6BD72" />
              {route.route ? <Polyline coordinates={route.route.points}
                strokeWidth={6} strokeColor="#9DF5C5" lineCap="round" lineJoin="round" /> : null}
            </MapView>
          </View>
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>MOTEUR DE NAVIGATION · API SIGNÉE</Text>
            {route.loading ? <ActivityIndicator color="#9DF5C5" /> : null}
            <Text style={styles.result}>{route.route
              ? "✓ Itinéraire Google vérifié dans DelishAfrica"
              : route.loading ? "Calcul de l’itinéraire public…" : "Itinéraire non activé"}</Text>
            {route.route ? <>
              <Text style={styles.subtitle}>
                {route.eta?.label || "Durée indisponible"} · {Math.round(route.route.distanceMeters / 100) / 10} km
              </Text>
              <Text style={styles.hint}>{route.route.points.length} points de tracé validés.</Text>
              {route.route.maneuvers.map((step, index) =>
                <Text key={index} style={styles.step}>{index + 1}. {step.instruction}</Text>)}
            </> : <>
              <Text style={styles.hint}>Diagnostic QA : {route.problem}. Aucun trajet artificiel n’est dessiné.</Text>
              <Pressable style={styles.retry} disabled={route.loading}
                accessibilityRole="button" onPress={route.refresh}>
                <Text style={styles.retryText}>↻ Réessayer la navigation interne</Text>
              </Pressable>
            </>}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#061E1A" },
  header: { flexDirection: "row", padding: 18, alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#153E30", alignItems: "center", justifyContent: "center" },
  backText: { color: "#F1FFE9", fontSize: 30 },
  brand: { color: "#B9E8CA", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F6FFF8", fontSize: 21, fontWeight: "800", marginTop: 3 },
  body: { paddingHorizontal: 17, paddingBottom: 36, gap: 14 },
  panel: { borderRadius: 22, padding: 18, backgroundColor: "#12392E", borderWidth: 1, borderColor: "#32594B", gap: 12 },
  eyebrow: { color: "#91E5B4", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  subtitle: { color: "#F3FFF7", fontSize: 17, lineHeight: 25, fontWeight: "800" },
  hint: { color: "#BDD8C9", fontSize: 12, lineHeight: 20 },
  mapFrame: { height: 365, overflow: "hidden", borderRadius: 22, backgroundColor: "#12392E" },
  result: { color: "#DFF7E5", fontSize: 18, fontWeight: "800", lineHeight: 26 },
  retry: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: "#E6BD72", borderRadius: 16 },
  retryText: { fontSize: 14, color: "#103C28", fontWeight: "900" },
  step: { fontSize: 13, lineHeight: 21, color: "#E2F2E8" },
});
