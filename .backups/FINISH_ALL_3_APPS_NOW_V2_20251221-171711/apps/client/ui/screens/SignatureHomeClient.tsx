import React, { useEffect, useMemo, useState, useRef } from 'react';
import { router , Link} from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "../theme";

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function Card({
  title,
  children,
  tone = "default",
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <View style={[styles.card, tone === "accent" ? styles.cardAccent : null]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Button({
  label,
  variant = "primary",
  onPress,
}: {
  label: string;
  variant?: "primary" | "secondary";
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" ? styles.btnPrimary : styles.btnSecondary,
        pressed ? { transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <Text style={variant === "primary" ? styles.btnTextPrimary : styles.btnTextSecondary}>{label}</Text>
    </Pressable>
  );
}

function TimelineItem({
  label,
  text,
  state = "idle",
}: {
  label: string;
  text: string;
  state?: "done" | "active" | "idle";
}) {
  return (
    <View style={styles.tItem}>
      <View
        style={[
          styles.dot,
          state === "done" ? styles.dotDone : null,
          state === "active" ? styles.dotActive : null,
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.tLabel}>{label}</Text>
        <Text style={styles.tText}>{text}</Text>
      </View>
    </View>
  );
}

export default function SignatureHomeClient() {
  // DA_ANIM_V1
  const animIn = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(animIn, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animIn]);

  const fadeInStyle = {
    opacity: animIn,
    transform: [
      { translateY: animIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      { scale: animIn.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
    ],
  };

  const insets = useSafeAreaInsets();
  const theme = getTheme("client");
  const c = theme.colors;

  const [apiMs, setApiMs] = useState<number>(128);
  const apiUrl = "https://api.delishafrica.me";

  useEffect(() => {
    // UX: simulate ping variance (demo)
    const t = setInterval(() => setApiMs((n) => Math.max(18, Math.min(260, n + (Math.random() * 26 - 13)))), 1400);
    return () => clearInterval(t);
  }, []);

  const header = useMemo(
    () => ({
      kicker: "DELISHAFRICA • CLIENT",
      title: "Découvrir.",
      subtitle: "Commander. Suivre.",
      lead: "Une expérience fluide, élégante — pensée pour l’action.",
    }),
    []
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(12, insets.top + 10), // ✅ anti-troncature notch
            paddingBottom: Math.max(18, insets.bottom + 18),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.kicker, { color: c.brand }]}>{header.kicker}</Text>
        <Text style={[styles.h1, { color: c.text }]}>{header.title}</Text>
        <Text style={[styles.h2, { color: c.subtext }]}>{header.subtitle}</Text>

        <View style={{ height: 14 }} />

        <Card title="API">
          <Text style={[styles.mono, { color: c.text }]}>{apiUrl}</Text>
          <View style={{ height: 8 }} />
          <Text style={[styles.status, { color: c.success }]}>Status: ok • {Math.round(apiMs)}ms</Text>
        </Card>

        <View style={{ height: 14 }} />

        <Card title="RESTAURANT VEDETTE" tone="accent">
          <Text style={[styles.big, { color: c.text }]}>Thieyp</Text>
          <Text style={[styles.p, { color: c.subtext }]}>
            Le goût authentique, une UX premium — commande rapide et suivi clair.
          </Text>

          <View style={{ height: 12 }} />
          <View style={styles.row}>
            <Button label="Commander (démo)" variant="primary" onPress={() => {}} />
            <Button label="Voir menu" variant="secondary" onPress={() => {}} />
          </View>
        </Card>

        <View style={{ height: 14 }} />

        <Card title="TIMELINE COMMANDE">
          <TimelineItem label="Commande" text="Créer la commande Thieyp (démo)." state="active" />
          <TimelineItem label="Préparation" text="Le restaurant prépare." state="idle" />
          <TimelineItem label="Pick-up" text="Le coursier récupère." state="idle" />
          <TimelineItem label="Livré" text="Confirmation côté client." state="idle" />
        </Card>

        <View style={{ height: 14 }} />

        <View style={styles.footerRow}>
          <Pill label="UI premium" />
          <Pill label="Flow démo" />
          <Pill label="SafeArea OK" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 18 },
  kicker: { letterSpacing: 4, fontWeight: "900", fontSize: 12 },
  h1: { fontSize: 44, fontWeight: "900", marginTop: 8 },
  h2: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  cardAccent: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardTitle: {
    letterSpacing: 3,
    fontWeight: "900",
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 10,
  },
  mono: { fontSize: 18, fontWeight: "900" },
  status: { fontSize: 15, fontWeight: "800" },
  big: { fontSize: 34, fontWeight: "900" },
  p: { fontSize: 15, lineHeight: 22, marginTop: 6, fontWeight: "600", opacity: 0.95 },
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#2ECC71" },
  btnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  btnTextPrimary: { color: "#081018", fontWeight: "900", fontSize: 17 },
  btnTextSecondary: { color: "#EAF2FF", fontWeight: "900", fontSize: 17 },
  tItem: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  dot: { width: 16, height: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 2 },
  dotDone: { backgroundColor: "#2ECC71" },
  dotActive: { backgroundColor: "#2ECC71" },
  tLabel: { fontSize: 18, fontWeight: "900", color: "#EAF2FF" },
  tText: { fontSize: 15, fontWeight: "700", color: "rgba(234,242,255,0.72)", marginTop: 4 },
  footerRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", opacity: 0.85 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pillText: { color: "rgba(234,242,255,0.86)", fontWeight: "800" },
});
