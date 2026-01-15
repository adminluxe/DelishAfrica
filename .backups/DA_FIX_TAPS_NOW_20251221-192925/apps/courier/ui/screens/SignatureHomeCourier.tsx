import React, { useEffect, useState, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "../theme";

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
 return (
 <View style={styles.card}>
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

export default function SignatureHomeCourier() {
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
 const theme = getTheme("courier");
 const c = theme.colors;

 const [apiMs, setApiMs] = useState<number>(77);
 const apiUrl = "https://api.delishafrica.me";

 useEffect(() => {
 const t = setInterval(() => setApiMs((n) => Math.max(18, Math.min(260, n + (Math.random() * 24 - 12)))), 1400);
 return () => clearInterval(t);
 }, []);

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
 <Text style={[styles.kicker, { color: c.brand }]}>DELISHAFRICA • COURIER</Text>
 <Text style={[styles.h1, { color: c.text }]}>En mouvement.</Text>
 <Text style={[styles.h2, { color: c.subtext }]}>Ultra lisible, ultra rapide. On ne perd jamais une seconde.</Text>

 <View style={{ height: 14 }} />

 <Card title="API">
 <Text style={[styles.mono, { color: c.text }]}>{apiUrl}</Text>
 <View style={{ height: 8 }} />
 <Text style={[styles.status, { color: c.success }]}>Status: ok • {Math.round(apiMs)}ms</Text>
 </Card>

 <View style={{ height: 14 }} />

 <Card title="MISSION DE DÉMO">
 <Text style={[styles.big, { color: c.text }]}>Livraison • Thieyp</Text>
 <Text style={[styles.p, { color: c.subtext }]}>Mission claire, CTA visibles — UX orientée action.</Text>

 <View style={{ height: 12 }} />
 <View style={styles.row}>
 <Button label="Voir mission " variant="primary" onPress={() => {}} />
 <Button label="Terminer " variant="secondary" onPress={() => {}} />
 </View>
 </Card>

 <View style={{ height: 14 }} />

 <Card title="TIMELINE MISSION">
 <TimelineItem label="Mission" text="Livraison Thieyp ." state="active" />
 <TimelineItem label="Pick-up" text="Récupérer la commande au restaurant." state="idle" />
 <TimelineItem label="Livré" text="Confirmer la livraison au client." state="idle" />
 </Card>
 </ScrollView>
 </SafeAreaView>
 );
}

const styles = StyleSheet.create({
 safe: { flex: 1 },
 container: { paddingHorizontal: 18 },
 kicker: { letterSpacing: 4, fontWeight: "900", fontSize: 12 },
 h1: { fontSize: 44, fontWeight: "900", marginTop: 8 },
 h2: { fontSize: 18, fontWeight: "700", marginTop: 6, opacity: 0.92 },
 card: {
 borderRadius: 26,
 borderWidth: 1,
 borderColor: "rgba(255,255,255,0.10)",
 backgroundColor: "rgba(255,255,255,0.04)",
 padding: 16,
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
 btnPrimary: { backgroundColor: "#2F7BFF" },
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
});
