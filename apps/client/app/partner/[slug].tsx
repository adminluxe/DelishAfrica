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

export default function PartnerDetailScreen() {
const router = useRouter();
const params = useLocalSearchParams<{ slug?: string }>();
const slug = useMemo(() => firstParam(params.slug) || "thieyp", [params.slug]);
const [restaurant, setRestaurant] = useState<DARestaurant | null>(null);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
try {
setLoading(true);
setRestaurant(await fetchRestaurantBySlug(slug));
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
<View style={styles.card}>
<Text style={styles.kicker}>PARTENAIRE DELISHAFRICA®</Text>
{loading && !restaurant ? <ActivityIndicator /> : null}

{restaurant ? (
<>
<Text style={styles.title}>{restaurant.name}</Text>
<Text style={styles.subtitle}>{restaurant.descriptionLong || restaurant.description || "Partenaire DelishAfrica."}</Text>
<Text style={styles.status}>{restaurantStatusLabel(restaurant)}</Text>

<View style={styles.infoCard}>
<Text style={styles.info}>{restaurant.address || restaurant.city}</Text>
<Text style={styles.info}>{restaurant.phone || "Contact partenaire à confirmer"}</Text>
<Text style={styles.info}>{restaurant.website || "Site partenaire à confirmer"}</Text>
</View>

<Pressable
style={[styles.primaryButton, !orderable && styles.disabledButton]}
disabled={!orderable}
onPress={() => router.push({ pathname: "/menu", params: { restaurantSlug: restaurant.slug } } as any)}
>
<Text style={styles.primaryButtonText}>{orderable ? "Commander chez ce partenaire" : "Bientôt disponible"}</Text>
</Pressable>
</>
) : (
<>
<Text style={styles.title}>Partenaire en préparation</Text>
<Text style={styles.subtitle}>Cette fiche sera activée après validation partenaire.</Text>
</>
)}

<Pressable style={styles.secondaryButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.secondaryButtonText}>Voir les restaurants</Text>
</Pressable>
</View>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#070A14" },
content: { padding: 20, paddingTop: 72, paddingBottom: 48 },
card: { borderRadius: 32, padding: 24, backgroundColor: "#11182A", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23, marginBottom: 16 },
status: { color: "#F7C873", fontWeight: "900", marginBottom: 14 },
infoCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 16 },
info: { color: "#FFFFFF", fontWeight: "800", marginBottom: 8 },
primaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F7C873", marginBottom: 10 },
primaryButtonText: { color: "#111827", fontWeight: "900", fontSize: 16 },
disabledButton: { backgroundColor: "#3B4050" },
secondaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});
