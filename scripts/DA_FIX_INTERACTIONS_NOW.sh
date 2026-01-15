#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/backups/DA_FIX_INTERACTIONS_$TS"
mkdir -p "$BK"

apps=("client" "merchant" "courier")

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    local rel="${f#$ROOT/}"
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$f" "$BK/$rel"
  fi
}

write_file() {
  local f="$1"
  local content="$2"
  mkdir -p "$(dirname "$f")"
  printf "%s" "$content" > "$f"
}

echo "================================================================="
echo "DA_FIX_INTERACTIONS_NOW — Fix boutons + routes (3 apps)"
echo "Backup => $BK"
echo "================================================================="

# -------------------------
# Shared: expo-router layout (safe)
# -------------------------
LAYOUT_CONTENT='import React from "react";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
  );
}
'

# -------------------------
# CLIENT
# -------------------------
CLIENT_INDEX='import React from "react";
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
'

CLIENT_ORDERS='import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Orders() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>THIEYP • COMMANDE</Text>
        <Text style={styles.h1}>Commande créée.</Text>
        <Text style={styles.sub}>Flux UI prêt. Backend sera branché ensuite.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>État</Text>
          <Text style={styles.line}>✔ Commande créée</Text>
          <Text style={styles.line}>⏳ En préparation</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.back()}>
            <Text style={styles.btnText}>Retour</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { /* next step later */ }}>
            <Text style={[styles.btnText, styles.btnTextDark]}>Suivre la livraison</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:"#070A10" },
  safe:{ flex:1, paddingHorizontal:18, paddingTop:64, paddingBottom:24 },
  kicker:{ color:"#2ED06E", letterSpacing:4, fontSize:12, fontWeight:"900" },
  h1:{ color:"#F4F7FF", fontSize:40, fontWeight:"900", marginTop:10 },
  sub:{ color:"#9AA6C5", fontSize:18, fontWeight:"700", marginTop:8 },

  card:{
    backgroundColor:"rgba(255,255,255,0.04)",
    borderColor:"rgba(255,255,255,0.10)",
    borderWidth:1,
    borderRadius:22,
    padding:16,
    marginTop:18
  },
  title:{ color:"rgba(255,255,255,0.75)", fontWeight:"900", fontSize:16 },
  line:{ color:"#F4F7FF", fontWeight:"800", fontSize:18, marginTop:10 },

  row:{ flexDirection:"row", gap:12, marginTop:18 },
  btn:{ flex:1, height:56, borderRadius:18, alignItems:"center", justifyContent:"center" },
  btnPrimary:{ backgroundColor:"#2ED06E" },
  btnGhost:{ borderWidth:1, borderColor:"rgba(255,255,255,0.18)", backgroundColor:"rgba(0,0,0,0.15)" },
  btnText:{ color:"#F4F7FF", fontSize:16, fontWeight:"900" },
  btnTextDark:{ color:"#07110A" },
});
'

# -------------------------
# MERCHANT
# -------------------------
MERCHANT_INDEX='import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Link } from "expo-router";

export default function MerchantHome() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>DELISHAFRICA • MERCHANT</Text>
        <Text style={styles.h1}>Poste cuisine.</Text>
        <Text style={styles.sub}>Actions rapides. Lisibilité maximale. Zéro stress.</Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>API</Text>
          <Text style={styles.cardTitle}>https://api.delishafrica.me</Text>
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
'

MERCHANT_ORDERS='import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Orders() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>THIEYP • CUISINE</Text>
        <Text style={styles.h1}>Commande en file.</Text>
        <Text style={styles.sub}>Mode stable : UI ok, actions visibles.</Text>

        <View style={styles.card}>
          <Text style={styles.line}>• Client : (à brancher)</Text>
          <Text style={styles.line}>• Plat : Thieyp</Text>
          <Text style={styles.line}>• Statut : En préparation</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.back()}>
            <Text style={styles.btnText}>Retour</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { /* next step later */ }}>
            <Text style={[styles.btnText, styles.btnTextDark]}>Marquer prêt</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:"#070A10" },
  safe:{ flex:1, paddingHorizontal:18, paddingTop:64, paddingBottom:24 },
  kicker:{ color:"#F29A4A", letterSpacing:4, fontSize:12, fontWeight:"900" },
  h1:{ color:"#F4F7FF", fontSize:40, fontWeight:"900", marginTop:10 },
  sub:{ color:"#B39A8A", fontSize:18, fontWeight:"700", marginTop:8 },

  card:{
    backgroundColor:"rgba(255,255,255,0.04)",
    borderColor:"rgba(255,255,255,0.10)",
    borderWidth:1,
    borderRadius:22,
    padding:16,
    marginTop:18
  },
  line:{ color:"#F4F7FF", fontWeight:"800", fontSize:18, marginTop:10 },

  row:{ flexDirection:"row", gap:12, marginTop:18 },
  btn:{ flex:1, height:56, borderRadius:18, alignItems:"center", justifyContent:"center" },
  btnPrimary:{ backgroundColor:"#F29A4A" },
  btnGhost:{ borderWidth:1, borderColor:"rgba(255,255,255,0.18)", backgroundColor:"rgba(0,0,0,0.15)" },
  btnText:{ color:"#F4F7FF", fontSize:16, fontWeight:"900" },
  btnTextDark:{ color:"#120A05" },
});
'

# -------------------------
# COURIER
# -------------------------
COURIER_INDEX='import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Link } from "expo-router";

export default function CourierHome() {
  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>DELISHAFRICA • COURIER</Text>
        <Text style={styles.h1}>En mouvement.</Text>
        <Text style={styles.sub}>Ultra lisible, ultra rapide. On ne perd jamais une seconde.</Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>API</Text>
          <Text style={styles.cardTitle}>https://api.delishafrica.me</Text>
          <Text style={styles.cardMeta}>Status: ok • {Platform.OS === "ios" ? "iOS" : "Android"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>MISSION</Text>
          <Text style={styles.cardBig}>Livraison • Thieyp</Text>
          <Text style={styles.cardDesc}>Mission claire, CTA visibles — UX orientée action.</Text>

          <View style={styles.row}>
            <Link href="/mission" asChild>
              <Pressable style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, styles.btnTextDark]}>Voir mission</Text>
              </Pressable>
            </Link>
            <Link href="/mission" asChild>
              <Pressable style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnText}>Terminer</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>TIMELINE MISSION</Text>

          <View style={styles.stepOn}>
            <View style={styles.dotOn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Mission</Text>
              <Text style={styles.stepDesc}>Livraison Thieyp.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Pick-up</Text>
              <Text style={styles.stepDesc}>Récupérer la commande au restaurant.</Text>
            </View>
          </View>

          <View style={styles.stepOff}>
            <View style={styles.dotOff} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Livré</Text>
              <Text style={styles.stepDesc}>Confirmer livraison au client.</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A10" },
  safe: { flex: 1, paddingHorizontal: 18, paddingTop: 64, paddingBottom: 24 },
  kicker: { color: "#2ED06E", letterSpacing: 4, fontSize: 12, fontWeight: "900" },
  h1: { color: "#F4F7FF", fontSize: 48, fontWeight: "900", marginTop: 10 },
  sub: { color: "#9AA6C5", fontSize: 20, fontWeight: "800", marginTop: 6, marginBottom: 18 },

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
  cardBig: { color: "#F4F7FF", fontSize: 38, fontWeight: "900", marginTop: 10 },
  cardDesc: { color: "#9AA6C5", fontSize: 18, fontWeight: "700", marginTop: 8 },

  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: { flex: 1, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#2F7BFF" },
  btnGhost: { borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(0,0,0,0.15)" },
  btnText: { color: "#F4F7FF", fontSize: 18, fontWeight: "900" },
  btnTextDark: { color: "#081025" },

  stepOn: { flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(47,123,255,0.06)", borderWidth: 1, borderColor: "rgba(47,123,255,0.18)", marginTop: 12 },
  stepOff:{ flexDirection: "row", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginTop: 12 },
  dotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2F7BFF", marginTop: 4 },
  dotOff:{ width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.16)", marginTop: 4 },
  stepTitle: { color: "#F4F7FF", fontSize: 22, fontWeight: "900" },
  stepDesc: { color: "#9AA6C5", fontSize: 16, fontWeight: "700", marginTop: 2 },
});
'

COURIER_MISSION='import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Mission() {
  const [step, setStep] = useState<"mission" | "pickup" | "delivered">("mission");

  return (
    <View style={styles.screen}>
      <View style={styles.safe}>
        <Text style={styles.kicker}>THIEYP • MISSION</Text>
        <Text style={styles.h1}>Mission en cours.</Text>
        <Text style={styles.sub}>CTA fonctionnels (flow UI). Backend ensuite.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Étapes</Text>
          <Text style={styles.line}>{step === "mission" ? "🟦" : "⚪️"} Mission</Text>
          <Text style={styles.line}>{step === "pickup" ? "🟦" : "⚪️"} Pick-up</Text>
          <Text style={styles.line}>{step === "delivered" ? "🟦" : "⚪️"} Livré</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.back()}>
            <Text style={styles.btnText}>Retour</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              setStep((s) => (s === "mission" ? "pickup" : s === "pickup" ? "delivered" : "delivered"));
            }}
          >
            <Text style={[styles.btnText, styles.btnTextDark]}>
              {step === "mission" ? "Confirmer pick-up" : step === "pickup" ? "Confirmer livraison" : "Terminé"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:"#070A10" },
  safe:{ flex:1, paddingHorizontal:18, paddingTop:64, paddingBottom:24 },
  kicker:{ color:"#2F7BFF", letterSpacing:4, fontSize:12, fontWeight:"900" },
  h1:{ color:"#F4F7FF", fontSize:40, fontWeight:"900", marginTop:10 },
  sub:{ color:"#9AA6C5", fontSize:18, fontWeight:"700", marginTop:8 },

  card:{
    backgroundColor:"rgba(255,255,255,0.04)",
    borderColor:"rgba(255,255,255,0.10)",
    borderWidth:1,
    borderRadius:22,
    padding:16,
    marginTop:18
  },
  title:{ color:"rgba(255,255,255,0.75)", fontWeight:"900", fontSize:16 },
  line:{ color:"#F4F7FF", fontWeight:"800", fontSize:18, marginTop:10 },

  row:{ flexDirection:"row", gap:12, marginTop:18 },
  btn:{ flex:1, height:56, borderRadius:18, alignItems:"center", justifyContent:"center" },
  btnPrimary:{ backgroundColor:"#2F7BFF" },
  btnGhost:{ borderWidth:1, borderColor:"rgba(255,255,255,0.18)", backgroundColor:"rgba(0,0,0,0.15)" },
  btnText:{ color:"#F4F7FF", fontSize:16, fontWeight:"900" },
  btnTextDark:{ color:"#081025" },
});
'

# -------------------------
# Apply per app
# -------------------------
for a in "${apps[@]}"; do
  APP_DIR="$ROOT/apps/$a"
  [ -d "$APP_DIR" ] || { echo "!! Missing $APP_DIR"; exit 1; }

  echo
  echo "==> Patching $a ..."

  # backup target files
  backup_file "$APP_DIR/app/_layout.tsx"
  backup_file "$APP_DIR/app/index.tsx"
  backup_file "$APP_DIR/app/orders.tsx"
  backup_file "$APP_DIR/app/mission.tsx"

  # ensure layout
  write_file "$APP_DIR/app/_layout.tsx" "$LAYOUT_CONTENT"

  if [ "$a" = "client" ]; then
    write_file "$APP_DIR/app/index.tsx" "$CLIENT_INDEX"
    write_file "$APP_DIR/app/orders.tsx" "$CLIENT_ORDERS"
  elif [ "$a" = "merchant" ]; then
    write_file "$APP_DIR/app/index.tsx" "$MERCHANT_INDEX"
    write_file "$APP_DIR/app/orders.tsx" "$MERCHANT_ORDERS"
  elif [ "$a" = "courier" ]; then
    write_file "$APP_DIR/app/index.tsx" "$COURIER_INDEX"
    write_file "$APP_DIR/app/mission.tsx" "$COURIER_MISSION"
  fi

  echo "   -> OK ($a)"
done

echo
echo "================================================================="
echo "DONE. Backups saved in: $BK"
echo "NEXT:"
echo "  - Restart metro for 3 apps with --clear"
echo "  - Force close apps on iPhone, re-scan QR"
echo "================================================================="
