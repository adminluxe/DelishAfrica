import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
cartItemSummary,
clearCart,
decrementCartItem,
formatCartEuro,
getCartSnapshot,
incrementCartItem,
removeFromCart,
} from "../utils/daCart";

export default function CartScreen() {
const router = useRouter();
const [version, setVersion] = useState(0);
const cart = useMemo(() => getCartSnapshot(), [version]);
const isEmpty = cart.items.length === 0;
const min = cart.minimumOrderAmount || 0;
const remaining = Math.max(0, min - cart.total);
const canCheckout = !isEmpty && remaining <= 0;

function refresh() {
setVersion((value) => value + 1);
}

function clear() {
Alert.alert("Vider le panier ?", `Votre sélection chez ${cart.restaurantName} sera retirée.`, [
{ text: "Annuler", style: "cancel" },
{
text: "Vider",
style: "destructive",
onPress: () => {
clearCart();
refresh();
},
},
]);
}

function checkout() {
if (isEmpty) {
Alert.alert("Panier vide", "Ajoutez un plat depuis le menu d’un restaurant.");
return;
}
if (!canCheckout) {
Alert.alert("Minimum panier", `Il manque ${formatCartEuro(remaining)} pour valider cette commande.`);
return;
}
router.push("/checkout-preflight" as any);
}

return (
<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA® PANIER</Text>
<Text style={styles.title}>{cartItemSummary(cart)}</Text>
<Text style={styles.subtitle}>
Une commande, un restaurant, une préparation claire pour la cuisine et le coursier.
</Text>

<View style={styles.restaurantCard}>
<Text style={styles.restaurantLabel}>Restaurant</Text>
<Text style={styles.restaurantName}>{cart.restaurantName}</Text>
<Text style={styles.restaurantText}>{cart.serviceAreaLabel || "Bruxelles"}</Text>
</View>
</View>

{isEmpty ? (
<View style={styles.emptyCard}>
<Text style={styles.emptyTitle}>Votre panier est vide</Text>
<Text style={styles.emptyText}>Choisissez un restaurant puis ajoutez un plat ou une boisson.</Text>
<Pressable
style={styles.primaryButton}
onPress={() =>
router.push({ pathname: "/menu", params: { restaurantSlug: cart.restaurantSlug || "thieyp" } } as any)
}
>
<Text style={styles.primaryButtonText}>Voir le menu</Text>
</Pressable>
</View>
) : (
<>
{cart.items.map((item) => (
<View key={item.id} style={styles.itemCard}>
<View style={{ flex: 1 }}>
<Text style={styles.itemTitle}>{item.name}</Text>
{item.description ? <Text style={styles.itemText}>{item.description}</Text> : null}
<Text style={styles.itemPrice}>{formatCartEuro(item.unitPrice)}</Text>
<Text style={styles.itemLine}>Total ligne : {formatCartEuro(item.unitPrice * item.quantity)}</Text>
</View>

<View style={styles.quantityColumn}>
<Pressable
style={styles.roundButton}
onPress={() => {
decrementCartItem(item.id);
refresh();
}}
>
<Text style={styles.roundButtonText}>−</Text>
</Pressable>
<Text style={styles.quantity}>{item.quantity}</Text>
<Pressable
style={styles.roundButton}
onPress={() => {
incrementCartItem(item.id);
refresh();
}}
>
<Text style={styles.roundButtonText}>+</Text>
</Pressable>
<Pressable
style={styles.removeButton}
onPress={() => {
removeFromCart(item.id);
refresh();
}}
>
<Text style={styles.removeButtonText}>Retirer</Text>
</Pressable>
</View>
</View>
))}

<View style={styles.totalCard}>
<View style={styles.totalRow}>
<Text style={styles.totalLabel}>Sous-total</Text>
<Text style={styles.totalValue}>{formatCartEuro(cart.subtotal)}</Text>
</View>
<View style={styles.totalRow}>
<Text style={styles.totalLabel}>Livraison</Text>
<Text style={styles.totalValue}>{formatCartEuro(cart.deliveryFee)}</Text>
</View>
<View style={styles.totalRow}>
<Text style={styles.grandLabel}>Total</Text>
<Text style={styles.grandTotal}>{formatCartEuro(cart.total)}</Text>
</View>

{min > 0 ? (
<Text style={styles.minimumText}>
{remaining > 0
? `Encore ${formatCartEuro(remaining)} pour atteindre le minimum de commande.`
: "Minimum de commande atteint."}
</Text>
) : (
<Text style={styles.minimumText}>Minimum de commande validé pour ce restaurant.</Text>
)}
</View>

<Pressable style={[styles.primaryButton, !canCheckout && styles.disabledButton]} onPress={checkout}>
<Text style={styles.primaryButtonText}>Paiement sécurisé</Text>
</Pressable>

<View style={styles.actions}>
<Pressable
style={styles.secondaryButton}
onPress={() =>
router.push({ pathname: "/menu", params: { restaurantSlug: cart.restaurantSlug || "thieyp" } } as any)
}
>
<Text style={styles.secondaryButtonText}>Ajouter un article</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={clear}>
<Text style={styles.secondaryButtonText}>Vider</Text>
</Pressable>
</View>
</>
)}
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
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23 },
restaurantCard: { marginTop: 18, borderRadius: 22, padding: 16, backgroundColor: "rgba(255,255,255,0.06)" },
restaurantLabel: { color: "#9DA8C7", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
restaurantName: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 4 },
restaurantText: { color: "#D8DDEE", fontWeight: "700", marginTop: 4 },
emptyCard: { borderRadius: 28, padding: 22, backgroundColor: "#0F1728", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
emptyTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 8 },
emptyText: { color: "#D8DDEE", lineHeight: 21, marginBottom: 16 },
itemCard: {
flexDirection: "row",
gap: 14,
borderRadius: 24,
padding: 16,
marginBottom: 12,
backgroundColor: "#0F1728",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.09)",
},
itemTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
itemText: { color: "#C8D0E8", marginTop: 6, lineHeight: 20 },
itemPrice: { color: "#F7C873", marginTop: 8, fontWeight: "900" },
itemLine: { color: "#9DA8C7", marginTop: 4, fontWeight: "700" },
quantityColumn: { alignItems: "center", gap: 8 },
roundButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F7C873" },
roundButtonText: { color: "#111827", fontSize: 20, fontWeight: "900" },
quantity: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
removeButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
removeButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
totalCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 8, marginBottom: 16 },
totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
totalLabel: { color: "#D8DDEE", fontSize: 17, fontWeight: "800" },
totalValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
grandLabel: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
grandTotal: { color: "#F7C873", fontSize: 22, fontWeight: "900" },
minimumText: { color: "#9DA8C7", fontWeight: "800", marginTop: 4, lineHeight: 20 },
primaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F7C873", marginBottom: 10 },
primaryButtonText: { color: "#111827", fontWeight: "900", fontSize: 16 },
disabledButton: { backgroundColor: "#3B4050" },
actions: { flexDirection: "row", gap: 10 },
secondaryButton: { flex: 1, borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
});
