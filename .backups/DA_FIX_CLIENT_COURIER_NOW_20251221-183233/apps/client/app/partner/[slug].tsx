import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import Constants from "expo-constants";
import {
 ActivityIndicator,
 Pressable,
 SafeAreaView,
 Text,
 View,
} from "react-native";

const API =
 process.env.EXPO_PUBLIC_API_URL ||
 (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_API_URL ||
 "https://api.delishafrica.me";

type PartnerDetail = {
 slug: string;
 name: string;
 description?: string;
 city?: string;
 cuisine?: string;
 address?: string;
 rating?: number;
};

const FALLBACK: PartnerDetail[] = [
 {
 slug: "thieyp",
 name: "Thieyp",
 city: "Bruxelles",
 cuisine: "Sénégalais",
 rating: 4.8,
 description: " partenaire — focus Thieyp (fallback si API indisponible).",
 address: "Bruxelles",
 },
 {
 slug: "afrosian",
 name: "Afrosian",
 city: "Bruxelles",
 cuisine: "Afro-asiatique",
 rating: 4.6,
 description: " partenaire (fallback) — carte & infos à enrichir.",
 address: "Bruxelles",
 },
 {
 slug: "toukoul",
 name: "Toukoul",
 city: "Bruxelles",
 cuisine: "Éthiopien",
 rating: 4.7,
 description: " partenaire (fallback) — carte & infos à enrichir.",
 address: "Bruxelles",
 },
];

async function fetchFirstOk<T>(paths: string[]): Promise<{ data: T; path: string }> {
 let lastErr: any = null;
 for (const p of paths) {
 try {
 const r = await fetch(`${API}${p}`);
 if (!r.ok) throw new Error(`HTTP ${r.status} on ${p}`);
 const j = (await r.json()) as T;
 return { data: j, path: p };
 } catch (e) {
 lastErr = e;
 }
 }
 throw lastErr ?? new Error("No endpoint succeeded");
}

function StatLine({ label, value }: { label: string; value?: string }) {
 if (!value) return null;
 return (
 <Text style={{ color: "#9CA3AF", marginTop: 6 }}>
 <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>{label}: </Text>
 {value}
 </Text>
 );
}

export default function PartnerScreen() {
 const { slug } = useLocalSearchParams<{ slug: string }>();
 const normalized = useMemo(() => (slug ?? "").toString().toLowerCase(), [slug]);

 const [loading, setLoading] = useState(false);
 const [source, setSource] = useState<string>("");
 const [data, setData] = useState<PartnerDetail | null>(null);

 const fallback = useMemo(
 () => FALLBACK.find((p) => p.slug === normalized) ?? null,
 [normalized]
 );

 const loadPartner = useCallback(async () => {
 setLoading(true);
 setSource("");
 try {
 const r = await fetchFirstOk<any>([
 `/api/partners/${normalized}`,
 `/partners/${normalized}`,
 ]);
 setData(r.data);
 setSource(r.path);
 } catch {
 setData(fallback);
 setSource(fallback ? "fallback" : "not-found");
 } finally {
 setLoading(false);
 }
 }, [normalized, fallback]);

 useEffect(() => {
 loadPartner();
 }, [loadPartner]);

 return (
 <SafeAreaView style={{ flex: 1 }}>
 {/* Background bubbles */}
 <View style={{ position: "absolute", top: -80, right: -90, width: 260, height: 260, borderRadius: 999, backgroundColor: "#0B2A4A", opacity: 0.35 }}}} pointerEvents="none"} />
 <View style={{ position: "absolute", bottom: -120, left: -110, width: 320, height: 320, borderRadius: 999, backgroundColor: "#111827", opacity: 0.35 }}}} pointerEvents="none"} />

 <View style={{ flex: 1, padding: 16 }}}} pointerEvents="none"}>
 <Stack.Screen options={{ title: "Fiche partenaire" }} />

 <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>Fiche partenaire</Text>
 <Text style={{ color: "#9CA3AF", marginTop: 6 }}>slug: {normalized || "—"}</Text>
 <Text style={{ color: "#9CA3AF", marginTop: 4, fontSize: 12 }}>source: {source || "—"}</Text>

 <View style={{ height: 14 }}}} pointerEvents="none"} />

 {loading && <ActivityIndicator />}

 {!loading && !data && (
 <View style={{ backgroundColor: "#0B1220", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#1F2937" }}}} pointerEvents="none"}>
 <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900" }}>Partenaire introuvable</Text>
 <Text style={{ color: "#9CA3AF", marginTop: 8 }}>
 On n’a pas encore la fiche pour “{normalized}”. (API offline + pas de fallback)
 </Text>
 </View>
 )}

 {!loading && data && (
 <View style={{ backgroundColor: "#0B1220", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#1F2937" }}}} pointerEvents="none"}>
 <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>{data.name}</Text>
 <Text style={{ color: "#9CA3AF", marginTop: 8 }}>
 {data.city ?? "Bruxelles"} • {data.cuisine ?? "Cuisine"} {data.rating ? `• ⭐ ${data.rating}` : ""}
 </Text>

 <StatLine label="Adresse" value={data.address} />

 {!!data.description && (
 <Text style={{ color: "#D1D5DB", marginTop: 12, lineHeight: 20 }}>
 {data.description}
 </Text>
 )}

 <View style={{ height: 12 }}}} pointerEvents="none"} />

 <Pressable
 onPress={loadPartner}
 style={{
 alignSelf: "flex-start",
 backgroundColor: "#111827",
 paddingHorizontal: 12,
 paddingVertical: 10,
 borderRadius: 14,
 borderWidth: 1,
 borderColor: "#1F2937",
 }}
 >
 <Text style={{ color: "#93C5FD", fontWeight: "900" }}>↻ Rafraîchir</Text>
 </Pressable>
 </View>
 )}

 <View style={{ height: 16 }}}} pointerEvents="none"} />

 <Link href="/" asChild>
 <Pressable style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#1F2937", alignItems: "center" }}>
 <Text style={{ color: "#93C5FD", fontWeight: "900" }}>← Retour accueil</Text>
 </Pressable>
 </Link>
 </View>
 </SafeAreaView>
 );
}
