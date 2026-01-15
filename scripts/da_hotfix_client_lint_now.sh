#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/delishafrica/monorepo/apps/client"
TS="$(date -Is | tr ':' '-')"
BK="${APP_DIR}/.tonton_backups/lint_hotfix_${TS}"
mkdir -p "$BK"

F1="${APP_DIR}/app/thieyp-demo.tsx"
F2="${APP_DIR}/src/ui/SnowOverlay.tsx"

echo "== Backup =="
[ -f "$F1" ] && cp -a "$F1" "$BK/thieyp-demo.tsx.bak" || true
[ -f "$F2" ] && cp -a "$F2" "$BK/SnowOverlay.tsx.bak" || true

mkdir -p "$(dirname "$F1")" "$(dirname "$F2")"

echo "== Write safe SnowOverlay.tsx =="
cat > "$F2" <<'TSX'
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

type Flake = {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export default function SnowOverlay() {
  const { width, height } = Dimensions.get("window");
  const translateY = useRef(new Animated.Value(0)).current;

  const flakes = useMemo<Flake[]>(() => {
    const count = 28;
    return Array.from({ length: count }, (_, id) => ({
      id,
      x: Math.random() * width,
      size: 2 + Math.random() * 3.5,
      duration: 7000 + Math.random() * 6000,
      delay: Math.random() * 2500,
      opacity: 0.25 + Math.random() * 0.35,
    }));
  }, [width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateY, {
        toValue: height + 40,
        duration: 11000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [height, translateY]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flakes.map((f) => (
        <Animated.View
          key={f.id}
          style={[
            styles.flake,
            {
              width: f.size,
              height: f.size,
              borderRadius: f.size / 2,
              left: f.x,
              opacity: f.opacity,
              transform: [
                {
                  translateY: Animated.modulo(
                    Animated.add(translateY, new Animated.Value(f.delay)),
                    height + 60
                  ),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flake: {
    position: "absolute",
    top: -40,
    backgroundColor: "#FFFFFF",
  },
});
TSX

echo "== Write safe thieyp-demo.tsx (no dupe keys) =="
cat > "$F1" <<'TSX'
import React, { useMemo } from "react";
import { router } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import SnowOverlay from "../src/ui/SnowOverlay";

function getApiBase() {
  // Expo env conventions
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://127.0.0.1:3010"
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
TSX

echo "✅ Hotfix applied."
echo "Backups in: $BK"
