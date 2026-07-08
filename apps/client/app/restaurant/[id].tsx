import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
DARestaurant,
fetchRestaurantBySlug,
isRestaurantOrderable,
restaurantStatusLabel,
} from "../../utils/daRestaurantCatalog";

function firstParam(value: string | string[] | undefined): string {
return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default function RestaurantDetailScreen() {
const router = useRouter();
const params = useLocalSearchParams<{ id?: string; slug?: string }>();
const slug = useMemo(() => firstParam(params.id || params.slug) || "thieyp", [params.id, params.slug]);
const [restaurant, setRestaurant] = useState<DARestaurant | null>(null);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("Chargement de la fiche restaurant…");

const load = useCallback(async () => {
try {
setLoading(true);
const next = await fetchRestaurantBySlug(slug);
setRestaurant(next);
setMessage(restaurantStatusLabel(next));
} catch (error) {
setMessage(error instanceof Error ? error.message : "Restaurant indisponible.");
} finally {
setLoading(false);
}
}, [slug]);

useEffect(() => {
load();
}, [load]);

const orderable = isRestaurantOrderable(restaurant);

return (
<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
{loading && !restaurant ? (
<View style={styles.loading}>
<ActivityIndicator />
<Text style={styles.loadingText}>Chargement…</Text>
</View>
) : null}

{restaurant ? (
<View style={styles.card}>
<Text style={styles.kicker}>DELISHAFRICA® RESTAURANT</Text>
<Text style={styles.title}>{restaurant.name}</Text>
<Text style={styles.subtitle}>{restaurant.description || "Partenaire DelishAfrica."}</Text>

<View style={styles.badge}>
<Text style={styles.badgeText}>{message}</Text>
</View>

<View style={styles.infoCard}>
<Text style={styles.infoLabel}>Cuisine</Text>
<Text style={styles.infoValue}>{restaurant.cuisine || restaurant.cuisines.join(", ") || "Africaine"}</Text>
<Text style={styles.infoLabel}>Adresse</Text>
<Text style={styles.infoValue}>{restaurant.address || [restaurant.area, restaurant.city].filter(Boolean).join(" · ")}</Text>
<Text style={styles.infoLabel}>Zone</Text>
<Text style={styles.infoValue}>{restaurant.delivery.serviceAreaLabel || "Bruxelles"}</Text>
</View>

<Pressable
style={[styles.primaryButton, !orderable && styles.disabledButton]}
disabled={!orderable}
onPress={() => router.push({ pathname: "/menu", params: { restaurantSlug: restaurant.slug } } as any)}
>
<Text style={styles.primaryButtonText}>{orderable ? "Ouvrir le menu" : "Ouverture bientôt"}</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.secondaryButtonText}>Retour restaurants</Text>
</Pressable>
</View>
) : (
<View style={styles.card}>
<Text style={styles.title}>Restaurant introuvable</Text>
<Text style={styles.subtitle}>{message}</Text>
<Pressable style={styles.secondaryButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.secondaryButtonText}>Retour restaurants</Text>
</Pressable>
</View>
)}
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#070A14" },
content: { padding: 20, paddingTop: 72, paddingBottom: 48 },
loading: { padding: 24, alignItems: "center" },
loadingText: { color: "#FFFFFF", marginTop: 10, fontWeight: "800" },
card: { borderRadius: 32, padding: 24, backgroundColor: "#11182A", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23, marginBottom: 16 },
badge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(247,200,115,0.16)", marginBottom: 18 },
badgeText: { color: "#F7C873", fontWeight: "900" },
infoCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 16 },
infoLabel: { color: "#9DA8C7", fontWeight: "900", marginTop: 8 },
infoValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginTop: 4 },
primaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F7C873", marginBottom: 10 },
primaryButtonText: { color: "#111827", fontWeight: "900", fontSize: 16 },
disabledButton: { backgroundColor: "#3B4050" },
secondaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});
