import React, { useCallback, useEffect, useState } from "react";
import {
ActivityIndicator,
Pressable,
RefreshControl,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { useRouter } from "expo-router";
import {
DARestaurant,
fetchRestaurants,
isRestaurantOrderable,
restaurantStatusLabel,
} from "../../utils/daRestaurantCatalog";

export default function RestaurantsScreen() {
const router = useRouter();
const [restaurants, setRestaurants] = useState<DARestaurant[]>([]);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("Catalogue DelishAfrica en préparation.");

const load = useCallback(async () => {
try {
setLoading(true);
const next = await fetchRestaurants();
setRestaurants(next);
setMessage(`${next.length} restaurant${next.length > 1 ? "s" : ""} dans la sélection.`);
} catch (error) {
setMessage(error instanceof Error ? error.message : "Catalogue indisponible.");
} finally {
setLoading(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

function openRestaurant(restaurant: DARestaurant) {
router.push(`/restaurant/${restaurant.slug}` as any);
}

function openMenu(restaurant: DARestaurant) {
if (!isRestaurantOrderable(restaurant)) return;
router.push({ pathname: "/menu", params: { restaurantSlug: restaurant.slug } } as any);
}

return (
<ScrollView
style={styles.screen}
contentContainerStyle={styles.content}
refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA®</Text>
<Text style={styles.title}>Restaurants</Text>
<Text style={styles.subtitle}>
Deux tables partenaires, deux identités culinaires : explorez Thieyp et La Boule Bleue dans la sélection DelishAfrica®.
</Text>
<Text style={styles.message}>{message}</Text>
</View>

{loading && restaurants.length === 0 ? (
<View style={styles.loadingCard}>
<ActivityIndicator />
<Text style={styles.loadingText}>Chargement du catalogue…</Text>
</View>
) : null}

{restaurants.map((restaurant) => {
const orderable = isRestaurantOrderable(restaurant);
return (
<View key={restaurant.slug} style={[styles.card, orderable ? styles.cardActive : styles.cardLocked]}>
<View style={styles.cardHeader}>
<View style={{ flex: 1 }}>
<Text style={styles.cardKicker}>{restaurant.cuisine || restaurant.cuisines[0] || "Cuisine africaine"}</Text>
<Text style={styles.cardTitle}>{restaurant.name}</Text>
<Text style={styles.cardText}>
{[restaurant.area, restaurant.city].filter(Boolean).join(" · ") || "Bruxelles"}
</Text>
</View>
<View style={[styles.badge, orderable ? styles.badgeActive : styles.badgeSoon]}>
<Text style={styles.badgeText}>{orderable ? "Actif" : "Bientôt"}</Text>
</View>
</View>

<Text style={styles.description}>
{restaurant.description || "Partenaire DelishAfrica en préparation."}
</Text>

<View style={styles.metaRow}>
<Text style={styles.meta}>{restaurant.rating ? `★ ${restaurant.rating}` : "★ Nouveau"}</Text>
<Text style={styles.meta}>{restaurant.delivery.serviceAreaLabel || "Bruxelles"}</Text>
<Text style={styles.meta}>{restaurantStatusLabel(restaurant)}</Text>
</View>

<View style={styles.actions}>
<Pressable style={styles.secondaryButton} onPress={() => openRestaurant(restaurant)}>
<Text style={styles.secondaryButtonText}>Voir la fiche</Text>
</Pressable>

<Pressable
style={[styles.primaryButton, !orderable && styles.disabledButton]}
onPress={() => openMenu(restaurant)}
disabled={!orderable}
>
<Text style={styles.primaryButtonText}>{orderable ? "Voir le menu" : "Ouverture bientôt"}</Text>
</Pressable>
</View>
</View>
);
})}

<View style={styles.footer}>
<Text style={styles.footerText}>
Panier mono-restaurant activé : une commande claire, un restaurant, une préparation maîtrisée.
</Text>
<Pressable
style={[styles.secondaryButton, { marginTop: 14, flex: 0 }]}
onPress={() => router.push("/delivery-zones" as any)}
>
<Text style={styles.secondaryButtonText}>Zones de livraison</Text>
</Pressable>
</View>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#070A14" },
content: { padding: 20, paddingTop: 72, paddingBottom: 48 },
hero: {
borderRadius: 32,
padding: 24,
backgroundColor: "#11182A",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 18,
},
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.2, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23 },
message: { color: "#9DA8C7", marginTop: 14, fontWeight: "700" },
loadingCard: { padding: 24, borderRadius: 24, backgroundColor: "#10182A", alignItems: "center", marginBottom: 16 },
loadingText: { color: "#D8DDEE", marginTop: 10, fontWeight: "800" },
card: {
borderRadius: 28,
padding: 20,
marginBottom: 16,
borderWidth: 1,
backgroundColor: "#0F1728",
},
cardActive: { borderColor: "rgba(247,200,115,0.42)" },
cardLocked: { borderColor: "rgba(255,255,255,0.10)", opacity: 0.88 },
cardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
cardKicker: { color: "#9DA8C7", fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: 6 },
cardTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
cardText: { color: "#D8DDEE", fontWeight: "700", marginTop: 4 },
description: { color: "#C8D0E8", lineHeight: 21, marginBottom: 14 },
badge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
badgeActive: { backgroundColor: "#1E7F4F" },
badgeSoon: { backgroundColor: "#4A5063" },
badgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
meta: { color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, fontWeight: "800" },
actions: { flexDirection: "row", gap: 10 },
primaryButton: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: "#F7C873" },
primaryButtonText: { color: "#111827", fontWeight: "900" },
secondaryButton: { flex: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
disabledButton: { backgroundColor: "#3B4050" },
footer: { padding: 18, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.06)" },
footerText: { color: "#9DA8C7", textAlign: "center", fontWeight: "800", lineHeight: 20 },
});
