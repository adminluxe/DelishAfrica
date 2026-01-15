import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";

type HealthState = "loading" | "ok" | "down";
type OrderState = "incoming" | "accepted" | "ready" | "refused";

function pickApiBase(): string {
 return (
 process.env.EXPO_PUBLIC_API_URL ||
 process.env.EXPO_PUBLIC_API_BASE_URL ||
 "https://api.delishafrica.me"
 );
}

async function pingHealth(base: string): Promise<boolean> {
 const urls = [`${base}/api/v1/health`, `${base}/api/health`, `${base}/health`];
 for (const url of urls) {
 try {
 const res = await fetch(url, { method: "GET" });
 if (res.ok) return true;
 } catch {}
 }
 return false;
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warn" | "danger" }) {
 const bg =
 tone === "success"
 ? "rgba(46, 204, 113, 0.18)"
 : tone === "warn"
 ? "rgba(241, 196, 15, 0.18)"
 : tone === "danger"
 ? "rgba(231, 76, 60, 0.18)"
 : "rgba(255,255,255,0.10)";

 const border =
 tone === "success"
 ? "rgba(46, 204, 113, 0.35)"
 : tone === "warn"
 ? "rgba(241, 196, 15, 0.35)"
 : tone === "danger"
 ? "rgba(231, 76, 60, 0.35)"
 : "rgba(255,255,255,0.14)";

 const color =
 tone === "success"
 ? "#B8F5D0"
 : tone === "warn"
 ? "#FFE9A6"
 : tone === "danger"
 ? "#FFC1BA"
 : "rgba(255,255,255,0.86)";

 return (
 <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
 <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
 </View>
 );
}

function ActionButton({
 label,
 onPress,
 tone,
 disabled,
}: {
 label: string;
 onPress: () => void;
 tone: "accept" | "ready" | "refuse" | "ghost";
 disabled?: boolean;
}) {
 const styles =
 tone === "accept"
 ? { bg: "rgba(243, 190, 90, 0.22)", br: "rgba(243, 190, 90, 0.38)", tx: "#FFE7B8" }
 : tone === "ready"
 ? { bg: "rgba(46, 204, 113, 0.18)", br: "rgba(46, 204, 113, 0.35)", tx: "#B8F5D0" }
 : tone === "refuse"
 ? { bg: "rgba(231, 76, 60, 0.22)", br: "rgba(231, 76, 60, 0.38)", tx: "#FFD0CB" }
 : { bg: "rgba(255,255,255,0.08)", br: "rgba(255,255,255,0.14)", tx: "rgba(255,255,255,0.92)" };

 return (
 <Pressable
 onPress={onPress}
 disabled={disabled}
 style={({ pressed }) => [
 {
 paddingVertical: 14,
 borderRadius: 16,
 backgroundColor: styles.bg,
 borderWidth: 1,
 borderColor: styles.br,
 opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
 transform: [{ scale: pressed ? 0.99 : 1 }],
 },
 ]}
 >
 <Text style={{ color: styles.tx, fontWeight: "900", textAlign: "center" }}>{label}</Text>
 </Pressable>
 );
}

export default function OrdersDemoMerchant() {
 const API = useMemo(() => pickApiBase(), []);
 const [health, setHealth] = useState<HealthState>("loading");
 const [orderState, setOrderState] = useState<OrderState>("incoming");

 useEffect(() => {
 let alive = true;
 (async () => {
 const ok = await pingHealth(API);
 if (!alive) return;
 setHealth(ok ? "ok" : "down");
 })();
 return () => {
 alive = false;
 };
 }, [API]);

 const statusLabel =
 orderState === "incoming"
 ? "Commande entrante"
 : orderState === "accepted"
 ? "Acceptée"
 : orderState === "ready"
 ? "Prête"
 : "Refusée";

 const statusTone = orderState === "ready" ? "success" : orderState === "refused" ? "danger" : orderState === "accepted" ? "warn" : "neutral";
 const healthLabel = health === "loading" ? "API: ..." : health === "ok" ? "API: OK" : "API: DOWN";

 return (
 <SafeAreaView style={{ flex: 1, backgroundColor: "#06060A" }}>
 <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
 <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 24, fontWeight: "900" }}>
 {statusLabel}
 </Text>

 <View style={{ marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
 <Pill label={healthLabel} tone={health === "ok" ? "success" : health === "down" ? "danger" : "neutral"} />
 <Pill label="Restaurant: Thieyp" tone="warn" />
 <Pill label={`Statut: ${statusLabel}`} tone={statusTone as any} />
 </View>

 <View
 style={{
 marginTop: 18,
 borderRadius: 20,
 borderWidth: 1,
 borderColor: "rgba(255,255,255,0.10)",
 backgroundColor: "rgba(255,255,255,0.06)",
 padding: 16,
 gap: 12,
 }}
 >
 <Text style={{ color: "rgba(255,255,255,0.90)", fontSize: 16, fontWeight: "900" }}>
 Détails (mock)
 </Text>

 <View style={{ gap: 8 }}>
 <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
 <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "700" }}>Client</Text>
 <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "900" }}>Tonton </Text>
 </View>

 <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />

 <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
 <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "700" }}>Plat</Text>
 <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "900" }}>Thieyp</Text>
 </View>

 <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />

 <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
 <Text style={{ color: "rgba(255,255,255,0.72)", fontWeight: "700" }}>Commande</Text>
 <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "900" }}>DA--THIEYP-001</Text>
 </View>
 </View>

 <View style={{ marginTop: 6, padding: 10, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
 <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: "800", lineHeight: 16 }}>
 “safe” : écran Merchant lisible (entrant → accepté → prêt). Aucun impact sur le routing existant.
 </Text>
 </View>
 </View>

 <View style={{ marginTop: 16, gap: 10 }}>
 <ActionButton
 label="Accepter"
 tone="accept"
 disabled={health === "loading" || orderState === "ready" || orderState === "refused"}
 onPress={() => setOrderState("accepted")}
 />

 <ActionButton
 label="Marquer prêt"
 tone="ready"
 disabled={health === "loading" || orderState !== "accepted"}
 onPress={() => setOrderState("ready")}
 />

 <ActionButton
 label="Refuser "
 tone="refuse"
 disabled={health === "loading" || orderState === "ready"}
 onPress={() => setOrderState("refused")}
 />

 <View style={{ flexDirection: "row", gap: 10 }}>
 <View style={{ flex: 1 }}>
 <ActionButton label="Reset" tone="ghost" onPress={() => setOrderState("incoming")} />
 </View>
 <View style={{ flex: 1 }}>
 <ActionButton
 label={health === "loading" ? "Ping..." : "Re-ping API"}
 tone="ghost"
 onPress={async () => {
 setHealth("loading");
 const ok = await pingHealth(API);
 setHealth(ok ? "ok" : "down");
 }}
 />
 </View>
 </View>
 </View>

 <View style={{ flex: 1 }} />
 </View>

 {health === "loading" ? (
 <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
 <ActivityIndicator />
 </View>
 ) : null}
 </SafeAreaView>
 );
}
