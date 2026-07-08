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
import {router, Link} from "expo-router";

function go(path: string) {
  router.push(path as any);
}

export default function CourierHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
            <Text style={styles.subtitle}>Missions et terrain</Text>
          </View>
          <View style={styles.livePill}>
            <Text style={styles.liveText}>READY</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>MISSION COCKPIT</Text>
          <Text style={styles.heroTitle}>Missions claires, rapides et sûres.</Text>
          <Text style={styles.heroText}>
            Commandes prêtes, actions utiles et suivi terrain.
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
            <Text style={styles.cardText}>Récupérer, guider, livrer.</Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </Pressable>

      <Link href="/notifications" asChild>
        <Pressable
          style={{
            marginTop: 12,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: "rgba(188,232,206,0.12)",
            borderWidth: 1,
            borderColor: "rgba(188,232,206,0.30)"
          }}
        >
          <Text style={{ color: "#EFFFF3", fontWeight: "900", textAlign: "center" }}>
            Alertes internes
          </Text>
          <Text style={{ color: "#BCE8CE", marginTop: 4, textAlign: "center", fontWeight: "700" }}>
            Missions prêtes, en route et livrées
          </Text>
        </Pressable>
      </Link>


<Pressable
style={{
marginTop: 18,
marginBottom: 18,
borderRadius: 30,
paddingVertical: 22,
paddingHorizontal: 22,
backgroundColor: "#B4F7C1",
}}
onPress={() => router.push("/courier-eta" as any)}
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
Distance et estimation terrain
</Text>
</Pressable>


<Pressable
style={{
marginTop: 18,
marginBottom: 18,
borderRadius: 30,
paddingVertical: 20,
paddingHorizontal: 22,
backgroundColor: "#E9FFF0",
borderWidth: 1,
borderColor: "rgba(142,240,179,0.60)",
}}
onPress={() => router.push("/courier-real-map" as any)}
>
<Text
style={{
color: "#052013",
fontSize: 34,
fontWeight: "900",
textAlign: "center",
}}
>
Maps terrain
</Text>
<Text
style={{
color: "rgba(5,32,19,0.74)",
fontSize: 19,
fontWeight: "800",
textAlign: "center",
marginTop: 8,
lineHeight: 26,
}}
>
Choisir Apple Plans, Google Maps ou Waze
</Text>
</Pressable>

<Pressable
onPress={() => go("/route-oracle")}
style={{
borderRadius: 24,
padding: 20,
backgroundColor: "#0E3A25",
borderWidth: 1,
borderColor: "rgba(103,230,155,0.28)",
marginBottom: 12
}}
>
<Text style={{ color: "#67E69B", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, marginBottom: 8 }}>
ROUTE ORACLE
</Text>
<Text style={{ color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginBottom: 8 }}>
Route Oracle
</Text>
<Text style={{ color: "rgba(214,255,227,0.72)", fontSize: 15, lineHeight: 22, fontWeight: "700" }}>
Score mission, ETA intelligente et décision coursier maîtrisée.
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
      
<Pressable
style={{
marginTop: 18,
marginBottom: 18,
borderRadius: 28,
borderWidth: 1,
borderColor: "rgba(156,247,184,0.38)",
backgroundColor: "#082719",
paddingVertical: 20,
paddingHorizontal: 22,
}}
onPress={() => router.push("/courier-space" as any)}
>
<Text
style={{
color: "#9CF7B8",
fontSize: 14,
fontWeight: "900",
letterSpacing: 4,
marginBottom: 8,
textTransform: "uppercase",
}}
>
Espace
</Text>
<Text
style={{
color: "#FFFFFF",
fontSize: 28,
fontWeight: "900",
marginBottom: 8,
}}
>
Mon profil coursier
</Text>
<Text
style={{
color: "rgba(255,255,255,0.72)",
fontSize: 16,
lineHeight: 24,
fontWeight: "700",
}}
>
Disponibilité, zone, véhicule et contact terrain.
</Text>
</Pressable>


<Pressable
onPress={() => go("/terrain-os")}
accessibilityRole="button"
style={{
marginTop: 18,
marginBottom: 4,
borderRadius: 30,
padding: 22,
minHeight: 152,
backgroundColor: "#082718",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.13)",
overflow: "hidden",
}}
>
<View
pointerEvents="none"
style={{
position: "absolute",
top: -44,
right: -52,
width: 126,
height: 126,
borderRadius: 999,
backgroundColor: "rgba(120,245,255,0.025)",
borderWidth: 1,
borderColor: "rgba(230,255,250,0.055)",
}}
/>
<View
pointerEvents="none"
style={{
position: "absolute",
bottom: 18,
left: -42,
width: 118,
height: 26,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.018)",
borderWidth: 1,
borderColor: "rgba(230,255,250,0.045)",
transform: [{ rotate: "-12deg" }],
}}
/>
<Text
style={{
color: "#67E69B",
fontSize: 12,
fontWeight: "900",
letterSpacing: 5,
}}
>
TERRAIN OS
</Text>
<Text
style={{
color: "#FFFFFF",
fontSize: 28,
lineHeight: 33,
fontWeight: "900",
marginTop: 10,
}}
>
Mission Mesh intelligent
</Text>
<Text
style={{
color: "rgba(220,255,235,0.78)",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
marginTop: 8,
}}
>
Route, ETA, charge et confiance pour décider plus vite sur le terrain.
</Text>
<View
style={{
alignSelf: "flex-start",
marginTop: 16,
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 10,
backgroundColor: "#67E69B",
}}
>
<Text
style={{
color: "#001D12",
fontSize: 14,
fontWeight: "900",
}}
>
Ouvrir Terrain OS →
</Text>
</View>
</Pressable>
</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(220, 255, 240, 0.052)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(212, 255, 236, 0.014)", borderWidth: 1, borderColor: "rgba(224, 255, 241, 0.040)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(200, 255, 232, 0.052)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 255, 238, 0.042)" },
  safe: { flex: 1, backgroundColor: "#03130D" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 46 },
  topbar: { marginTop: 8, marginBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#67E69B", fontSize: 13, fontWeight: "900", letterSpacing: 4 },
  subtitle: { color: "#BEEFD0", marginTop: 6, fontSize: 14, fontWeight: "800" },
  livePill: { backgroundColor: "rgba(103,230,155,0.14)", borderColor: "rgba(103,230,155,0.35)", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  liveText: { color: "#8CFFB6", fontWeight: "900", fontSize: 12, letterSpacing: 2 },
  hero: { backgroundColor: "#092016", borderRadius: 28, padding: 20, borderWidth: 1, borderColor: "rgba(103,230,155,0.18)", marginBottom: 18 },
  kicker: { color: "#8CFFB6", fontSize: 11, fontWeight: "900", letterSpacing: 5, marginBottom: 10 },
  kickerLight: { color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "900", letterSpacing: 5, marginBottom: 10 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 35, fontWeight: "900" },
  heroText: { color: "#C8F2D7", fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: "700" },
  routeLine: { flexDirection: "row", alignItems: "center", marginTop: 22 },
  routeStep: { alignItems: "center" },
  routeNumber: { color: "#032012", backgroundColor: "#67E69B", overflow: "hidden", borderRadius: 999, width: 34, height: 34, textAlign: "center", lineHeight: 34, fontWeight: "900" },
  routeLabel: { color: "#D6FFE3", fontSize: 11, fontWeight: "800", marginTop: 7 },
  routeBar: { flex: 1, height: 2, backgroundColor: "rgba(103,230,155,0.25)", marginHorizontal: 8 },
  primaryCard: { minHeight: 112, borderRadius: 26, padding: 20, backgroundColor: "#18A957", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
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
