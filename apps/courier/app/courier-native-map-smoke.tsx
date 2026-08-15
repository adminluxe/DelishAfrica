// DA_A5A3A7S16R9A2A_NATIVE_MAPS_SMOKE_V1
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";

const THIEYP = {
  latitude: 50.8359,
  longitude: 4.3717,
};

const CLIENT_DEMO = {
  latitude: 50.8195,
  longitude: 4.4302,
};

const INITIAL_REGION = {
  latitude: 50.8282,
  longitude: 4.4009,
  latitudeDelta: 0.055,
  longitudeDelta: 0.075,
};

export default function CourierNativeMapSmokeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
          <Text style={styles.kicker}>R9A2A · CARTE NATIVE</Text>
          <Text style={styles.title}>Le terrain entre dans l’app.</Text>
          <Text style={styles.body}>
            Smoke natif isolé. Aucun appel API, aucune localisation utilisateur et aucune mutation de mission.
          </Text>
        </View>

        <View style={styles.mapShell}>
          <MapView
            style={styles.map}
            initialRegion={INITIAL_REGION}
            mapType="standard"
            loadingEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            showsCompass
            showsScale
            accessibilityLabel="Carte native Courier entre Thieyp et une destination de test"
          >
            <Marker coordinate={THIEYP} title="Thieyp" description="Rue Longue Vie 46 · Ixelles" />
            <Marker coordinate={CLIENT_DEMO} title="Destination test" description="Point de validation R9A2A" />
            <Polyline
              coordinates={[THIEYP, CLIENT_DEMO]}
              strokeColor="#D9A928"
              strokeWidth={5}
              lineDashPattern={[10, 8]}
            />
          </MapView>

          <View pointerEvents="none" style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>APPLE MAPS · NATIF IOS</Text>
          </View>
        </View>

        <View style={styles.truthCard}>
          <Text style={styles.truthKicker}>VÉRITÉ DU PALIER</Text>
          <Text style={styles.truthTitle}>Deux repères. Une ligne. Zéro logique métier.</Text>
          <Text style={styles.truthText}>
            Si cette carte s’affiche et se déplace sans écran rouge, le module natif Maps du nouveau Dev Client Courier est validé.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.primaryButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour au cockpit Courier"
        >
          <Text style={styles.primaryButtonText}>Retour au cockpit</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#031A12" },
  page: { padding: 20, paddingBottom: 44, gap: 18 },
  header: { gap: 8 },
  brand: { color: "#8EF0B3", fontSize: 12, fontWeight: "900", letterSpacing: 2.4 },
  kicker: { color: "#D9A928", fontSize: 11, fontWeight: "900", letterSpacing: 1.8, marginTop: 8 },
  title: { color: "#F7FFF9", fontSize: 38, fontWeight: "900", lineHeight: 42 },
  body: { color: "#B7D4C1", fontSize: 15, lineHeight: 23, fontWeight: "700" },
  mapShell: {
    height: 470,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.34)",
    backgroundColor: "#082719",
  },
  map: { flex: 1 },
  mapBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(3,26,18,0.88)",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.42)",
  },
  mapBadgeText: { color: "#8EF0B3", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  truthCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: "#E9FFF0",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.60)",
  },
  truthKicker: { color: "#147040", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  truthTitle: { color: "#052013", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 8 },
  truthText: { color: "rgba(5,32,19,0.72)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 8 },
  primaryButton: { borderRadius: 24, paddingVertical: 17, alignItems: "center", backgroundColor: "#8EF0B3" },
  primaryButtonText: { color: "#052013", fontSize: 16, fontWeight: "900" },
});
