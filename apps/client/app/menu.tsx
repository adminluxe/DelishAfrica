import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Alert,
Pressable,
RefreshControl,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
addToCart,
cartItemSummary,
clearCart,
formatCartEuro,
getCartSnapshot,
} from "../utils/daCart";
import {
DAApiMenuItem,
DARestaurant,
fetchRestaurantBySlug,
isRestaurantOrderable,
menuItemAmount,
menuItemId,
restaurantStatusLabel,
restaurantToCartRestaurant,
} from "../utils/daRestaurantCatalog";

function firstParam(value: string | string[] | undefined): string {
return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function categoryOf(item: DAApiMenuItem): string {
return String(item.category || "Menu");
}

export default function MenuScreen() {
const router = useRouter();
const params = useLocalSearchParams<{ restaurantSlug?: string; slug?: string; id?: string }>();
const slug = useMemo(
() => firstParam(params.restaurantSlug || params.slug || params.id) || "thieyp",
[params.restaurantSlug, params.slug, params.id],
);

const [restaurant, setRestaurant] = useState<DARestaurant | null>(null);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("Chargement du menu…");
const [cartVersion, setCartVersion] = useState(0);

const cart = useMemo(() => getCartSnapshot(), [cartVersion]);

const load = useCallback(async () => {
try {
setLoading(true);
const next = await fetchRestaurantBySlug(slug);
setRestaurant(next);
setMessage(restaurantStatusLabel(next));
} catch (error) {
setMessage(error instanceof Error ? error.message : "Menu indisponible.");
} finally {
setLoading(false);
}
}, [slug]);

useEffect(() => {
load();
}, [load]);

const groups = useMemo(() => {
const map = new Map<string, DAApiMenuItem[]>();
for (const item of restaurant?.menuItems || []) {
const key = categoryOf(item);
map.set(key, [...(map.get(key) || []), item]);
}
return Array.from(map.entries());
}, [restaurant]);

const orderable = isRestaurantOrderable(restaurant);

function refreshCart() {
setCartVersion((value) => value + 1);
}

function addItem(item: DAApiMenuItem) {
if (!restaurant || !orderable) return;

const context = restaurantToCartRestaurant(restaurant);
const payload = {
id: menuItemId(item),
sku: menuItemId(item),
name: String(item.name || "Plat DelishAfrica"),
category: item.category,
description: item.description,
unitPrice: menuItemAmount(item),
quantity: 1,
};

try {
addToCart(payload, context);
refreshCart();
setMessage(`${payload.name} ajouté au panier.`);
} catch (error: any) {
if (error?.code === "DA_CART_RESTAURANT_MISMATCH") {
Alert.alert(
"Changer de restaurant ?",
error.message || "Votre panier contient déjà des plats d’un autre restaurant.",
[
{ text: "Annuler", style: "cancel" },
{
text: "Vider et commencer",
style: "destructive",
onPress: () => {
clearCart(context);
addToCart(payload, context);
refreshCart();
setMessage(`${payload.name} ajouté au panier.`);
},
},
],
);
return;
}

Alert.alert("Panier", error instanceof Error ? error.message : "Impossible d’ajouter cet article.");
}
}

return (
<ScrollView
style={styles.screen}
contentContainerStyle={styles.content}
refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA® MENU</Text>
<Text style={styles.title}>{restaurant?.name || "Menu"}</Text>
<Text style={styles.subtitle}>
{restaurant?.description || "Sélectionnez vos plats, gardez un panier clair et validez en paiement sécurisé."}
</Text>
<Text style={styles.message}>{message}</Text>

<View style={styles.heroActions}>
<Pressable style={styles.secondaryButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.secondaryButtonText}>Restaurants</Text>
</Pressable>
<Pressable style={styles.primaryButtonSmall} onPress={() => router.push("/cart" as any)}>
<Text style={styles.primaryButtonText}>{cartItemSummary(cart)}</Text>
</Pressable>
</View>
</View>

{loading && !restaurant ? (
<View style={styles.loadingCard}>
<ActivityIndicator />
<Text style={styles.loadingText}>Chargement du menu…</Text>
</View>
) : null}

{restaurant && !orderable ? (
<View style={styles.lockedCard}>
<Text style={styles.lockedTitle}>Ouverture bientôt</Text>
<Text style={styles.lockedText}>
Ce partenaire est visible dans le catalogue, mais les commandes ne sont pas encore ouvertes.
</Text>
</View>
) : null}

{groups.map(([category, items]) => (
<View key={category} style={styles.section}>
<Text style={styles.sectionTitle}>{category}</Text>

{items.map((item, index) => {
const id = menuItemId(item, index);
const amount = menuItemAmount(item);
return (
<View key={id} style={styles.itemCard}>
<View style={{ flex: 1 }}>
<Text style={styles.itemTitle}>{item.name || "Plat DelishAfrica"}</Text>
{item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
<Text style={styles.itemMeta}>{formatCartEuro(amount)}</Text>
</View>

<Pressable
style={[styles.addButton, !orderable && styles.disabledButton]}
disabled={!orderable}
onPress={() => addItem(item)}
>
<Text style={styles.addButtonText}>{orderable ? "Ajouter" : "Bientôt"}</Text>
</Pressable>
</View>
);
})}
</View>
))}

{restaurant && groups.length === 0 ? (
<View style={styles.lockedCard}>
<Text style={styles.lockedTitle}>Menu en préparation</Text>
<Text style={styles.lockedText}>Les plats de ce partenaire seront activés après validation.</Text>
</View>
) : null}

<View style={styles.cartDock}>
<View style={{ flex: 1 }}>
<Text style={styles.cartLabel}>Panier</Text>
<Text style={styles.cartTitle}>{cartItemSummary(cart)}</Text>
<Text style={styles.cartText}>{cart.restaurantName}</Text>
</View>
<Pressable style={styles.primaryButtonSmall} onPress={() => router.push("/cart" as any)}>
<Text style={styles.primaryButtonText}>Voir</Text>
</Pressable>
</View>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#070A14" },
content: { padding: 20, paddingTop: 72, paddingBottom: 110 },
hero: {
borderRadius: 32,
padding: 24,
backgroundColor: "#11182A",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 18,
},
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23 },
message: { color: "#9DA8C7", marginTop: 14, fontWeight: "800" },
heroActions: { flexDirection: "row", gap: 10, marginTop: 18 },
loadingCard: { padding: 24, borderRadius: 24, backgroundColor: "#10182A", alignItems: "center", marginBottom: 16 },
loadingText: { color: "#D8DDEE", marginTop: 10, fontWeight: "800" },
lockedCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 16 },
lockedTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginBottom: 6 },
lockedText: { color: "#D8DDEE", lineHeight: 21 },
section: { marginBottom: 18 },
sectionTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 12 },
itemCard: {
flexDirection: "row",
gap: 12,
borderRadius: 24,
padding: 16,
backgroundColor: "#0F1728",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.09)",
marginBottom: 12,
},
itemTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
itemDescription: { color: "#C8D0E8", marginTop: 6, lineHeight: 20 },
itemMeta: { color: "#F7C873", marginTop: 8, fontWeight: "900" },
addButton: { alignSelf: "center", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F7C873" },
addButtonText: { color: "#111827", fontWeight: "900" },
disabledButton: { backgroundColor: "#3B4050" },
primaryButtonSmall: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F7C873" },
primaryButtonText: { color: "#111827", fontWeight: "900" },
secondaryButton: { flex: 1, borderRadius: 18, paddingVertical: 13, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
cartDock: {
position: "absolute",
left: 20,
right: 20,
bottom: 22,
borderRadius: 26,
padding: 16,
flexDirection: "row",
alignItems: "center",
gap: 12,
backgroundColor: "#11182A",
borderWidth: 1,
borderColor: "rgba(247,200,115,0.34)",
},
cartLabel: { color: "#9DA8C7", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
cartTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 2 },
cartText: { color: "#D8DDEE", fontWeight: "700", marginTop: 2 },
});
