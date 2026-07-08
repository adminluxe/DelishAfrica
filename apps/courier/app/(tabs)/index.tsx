import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

function go(path: string) {
  router.push(path as any);
}

export default function CourierHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DELISHAFRICA · COURIER</Text>
            <Text style={styles.subtitle}>Terrain & livraison</Text>
          </View>
          <View style={styles.livePill}>
            <Text style={styles.liveText}>READY</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>MISSION COCKPIT</Text>
          <Text style={styles.heroTitle}>Chaque mission doit être claire en trois secondes.</Text>
          <Text style={styles.heroText}>
            Priorité aux commandes prêtes, aux actions simples et au suivi terrain sans ambiguïté.
          </Text>

          <View style={styles.routeLine}>
            <View style={styles.routeStep}><Text style={styles.routeNumber}>1</Text><Text style={styles.routeLabel}>Prête</Text></View>
            <View style={styles.routeBar} />
            <View style={styles.routeStep}><Text style={styles.routeNumber}>2</Text><Text style={styles.routeLabel}>Récupérée</Text></View>
            <View style={styles.routeBar} />
            <View style={styles.routeStep}><Text style={styles.routeNumber}>3</Text><Text style={styles.routeLabel}>Livrée</Text></View>
          </View>
        </View>

        <Pressable style={styles.primaryCard} onPress={() => go("/orders-demo")}>
          <View>
            <Text style={styles.kickerLight}>MISSIONS</Text>
            <Text style={styles.cardTitle}>Voir les missions</Text>
            <Text style={styles.cardText}>Récupérer les commandes prêtes et confirmer la livraison.</Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </Pressable>

<Pressable
onPress={() => router.push("/courier-eta")}
style={{
marginTop: 18,
marginBottom: 18,
borderRadius: 30,
paddingVertical: 22,
paddingHorizontal: 22,
backgroundColor: "#B4F7C1",
}}
>
<Text
style={{
color: "#052013",
fontSize: 26,
fontWeight: "900",
textAlign: "center",
}}
>
ETA mission
</Text>
<Text
style={{
color: "rgba(5,32,19,0.72)",
fontSize: 15,
fontWeight: "800",
textAlign: "center",
marginTop: 7,
}}
>
Distance terrain et estimation livraison
</Text>
</Pressable>


        <View style={styles.grid}>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>Lisibilité</Text>
            <Text style={styles.smallText}>Actions rapides, statuts clairs, lecture immédiate.</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.smallTitle}>Terrain</Text>
            <Text style={styles.smallText}>Pensé pour une utilisation rapide, dehors, en mouvement.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Règle de service</Text>
          <Text style={styles.footerText}>
            Une mission prête se récupère. Une mission récupérée se livre. Une mission livrée disparaît du cockpit actif.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#03130D" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 46 },
  topbar: { marginTop: 8, marginBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#67E69B", fontSize: 13, fontWeight: "900", letterSpacing: 4 },
  subtitle: { color: "#BEEFD0", marginTop: 6, fontSize: 14, fontWeight: "800" },
  livePill: { backgroundColor: "rgba(103,230,155,0.14)", borderColor: "rgba(103,230,155,0.35)", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  liveText: { color: "#8CFFB6", fontWeight: "900", fontSize: 12, letterSpacing: 2 },
  hero: { backgroundColor: "#092016", borderRadius: 30, padding: 22, borderWidth: 1, borderColor: "rgba(103,230,155,0.18)", marginBottom: 18 },
  kicker: { color: "#8CFFB6", fontSize: 11, fontWeight: "900", letterSpacing: 5, marginBottom: 10 },
  kickerLight: { color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "900", letterSpacing: 5, marginBottom: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900" },
  heroText: { color: "#C8F2D7", fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: "700" },
  routeLine: { flexDirection: "row", alignItems: "center", marginTop: 22 },
  routeStep: { alignItems: "center" },
  routeNumber: { color: "#032012", backgroundColor: "#67E69B", overflow: "hidden", borderRadius: 999, width: 34, height: 34, textAlign: "center", lineHeight: 34, fontWeight: "900" },
  routeLabel: { color: "#D6FFE3", fontSize: 11, fontWeight: "800", marginTop: 7 },
  routeBar: { flex: 1, height: 2, backgroundColor: "rgba(103,230,155,0.25)", marginHorizontal: 8 },
  primaryCard: { minHeight: 128, borderRadius: 26, padding: 20, backgroundColor: "#18A957", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" },
  cardText: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 260, fontWeight: "700" },
  cardArrow: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
  grid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  smallCard: { flex: 1, backgroundColor: "#092016", borderWidth: 1, borderColor: "rgba(103,230,155,0.16)", borderRadius: 22, padding: 16 },
  smallTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  smallText: { color: "#BFEBD0", lineHeight: 19, marginTop: 7, fontSize: 13, fontWeight: "700" },
  footer: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 18 },
  footerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  footerText: { color: "#C8F2D7", lineHeight: 20, marginTop: 8, fontWeight: "700" },
});
