import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const minimum = cart.minimumOrderAmount || 0;
  const remaining = Math.max(0, minimum - cart.total);
  const canCheckout = !isEmpty && remaining <= 0;
  const areaLabel = cart.serviceAreaLabel || "Zone de livraison à confirmer";

  function refresh() {
    setVersion((value) => value + 1);
  }

  function returnToMarketplace() {
    router.replace("/" as any);
  }

  function continueSelection() {
    if (!cart.restaurantSlug) {
      returnToMarketplace();
      return;
    }

    router.push({ pathname: "/menu", params: { restaurantSlug: cart.restaurantSlug } } as any);
  }

  function clear() {
    Alert.alert(
      "Vider le panier ?",
      `Votre sélection chez ${cart.restaurantName || "ce restaurant"} sera retirée.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Vider",
          style: "destructive",
          onPress: () => {
            clearCart();
            refresh();
          },
        },
      ],
    );
  }

  function checkout() {
    if (isEmpty) {
      Alert.alert("Panier vide", "Choisissez une adresse depuis la marketplace.");
      return;
    }

    if (!canCheckout) {
      Alert.alert(
        "Minimum panier",
        `Il manque ${formatCartEuro(remaining)} pour valider cette commande.`,
      );
      return;
    }

    router.push("/checkout-preflight" as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DELISHAFRICA® · CLIENT</Text>
            <Text style={styles.sectionName}>Commande essentielle</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.topButton, pressed && styles.pressFeedback]}
            onPress={returnToMarketplace}
            accessibilityRole="button"
            accessibilityLabel="Retour à la marketplace"
            hitSlop={8}
          >
            <Text style={styles.topButtonText}>Marketplace</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.kicker}>VOTRE COMMANDE</Text>
          <Text style={styles.title}>Choisir. Vérifier. Payer.</Text>
          <Text style={styles.subtitle}>
            Une commande, une adresse, une action principale. Le reste reste disponible sans prendre le dessus.
          </Text>
        </View>

        {isEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardEyebrow}>PANIER DISPONIBLE</Text>
            <Text style={styles.emptyTitle}>Votre prochaine envie commence dans la marketplace.</Text>
            <Text style={styles.emptyText}>
              Sélectionnez un partenaire actif, composez votre commande puis revenez ici pour la valider.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressFeedback]}
              onPress={returnToMarketplace}
              accessibilityRole="button"
              accessibilityLabel="Explorer les partenaires"
              accessibilityHint="Retourne à la marketplace pour commencer une commande"
            >
              <Text style={styles.primaryButtonText}>Explorer les partenaires</Text>
              <Text style={styles.primaryArrow}>→</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderHeaderText}>
                  <Text style={styles.cardEyebrow}>COMMANDE EN COURS</Text>
                  <Text style={styles.restaurantName}>{cart.restaurantName}</Text>
                  <Text style={styles.restaurantMeta}>{areaLabel}</Text>
                </View>
                <View style={styles.itemCountPill}>
                  <Text style={styles.itemCountText}>{cartItemSummary(cart)}</Text>
                </View>
              </View>

              <View style={styles.stepRail}>
                <View style={styles.stepActive}>
                  <Text style={styles.stepNumberActive}>1</Text>
                  <Text style={styles.stepLabelActive}>Choisir</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.stepIdle}>
                  <Text style={styles.stepNumberIdle}>2</Text>
                  <Text style={styles.stepLabelIdle}>Vérifier</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.stepIdle}>
                  <Text style={styles.stepNumberIdle}>3</Text>
                  <Text style={styles.stepLabelIdle}>Payer</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {cart.items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text style={styles.itemPrice}>
                        {formatCartEuro(item.unitPrice * item.quantity)}
                      </Text>
                    </View>

                    <View style={styles.quantityBlock}>
                      <View style={styles.quantityRail}>
                        <Pressable
                          style={({ pressed }) => [styles.quantityButton, pressed && styles.pressFeedback]}
                          onPress={() => {
                            decrementCartItem(item.id);
                            refresh();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Retirer une unité de ${item.name}`}
                          accessibilityValue={{ text: `${item.quantity}` }}
                          hitSlop={8}
                        >
                          <Text style={styles.quantityButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.quantity}>{item.quantity}</Text>
                        <Pressable
                          style={({ pressed }) => [styles.quantityButton, pressed && styles.pressFeedback]}
                          onPress={() => {
                            incrementCartItem(item.id);
                            refresh();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Ajouter une unité de ${item.name}`}
                          accessibilityValue={{ text: `${item.quantity}` }}
                          hitSlop={8}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        style={({ pressed }) => pressed && styles.pressFeedback}
                        onPress={() => {
                          removeFromCart(item.id);
                          refresh();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${item.name} du panier`}
                        hitSlop={8}
                      >
                        <Text style={styles.removeText}>Retirer</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.summaryBlock}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sous-total</Text>
                  <Text style={styles.summaryValue}>{formatCartEuro(cart.subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Livraison</Text>
                  <Text style={styles.summaryValue}>{formatCartEuro(cart.deliveryFee)}</Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatCartEuro(cart.total)}</Text>
                </View>
                <Text style={[styles.minimumText, canCheckout && styles.minimumReady]}>
                  {remaining > 0
                    ? `Encore ${formatCartEuro(remaining)} pour atteindre le minimum.`
                    : "Commande prête pour le paiement sécurisé."}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.primaryButton, !canCheckout && styles.disabledButton, pressed && styles.pressFeedback]}
                onPress={checkout}
                accessibilityRole="button"
                accessibilityLabel="Continuer vers le paiement sécurisé"
                accessibilityHint={canCheckout ? "Ouvre la vérification finale avant paiement" : `Il manque ${formatCartEuro(remaining)} pour atteindre le minimum`}
              >
                <Text style={styles.primaryButtonText}>Continuer vers le paiement</Text>
                <Text style={styles.primaryArrow}>→</Text>
              </Pressable>
            </View>

            <View style={styles.secondaryPanel}>
              <View>
                <Text style={styles.secondaryKicker}>AJUSTER SANS DISTRAIRE</Text>
                <Text style={styles.secondaryTitle}>Votre sélection reste modifiable.</Text>
              </View>
              <View style={styles.secondaryActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressFeedback]}
                  onPress={continueSelection}
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter un article à la commande"
                >
                  <Text style={styles.secondaryButtonText}>Ajouter un article</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.clearButton, pressed && styles.pressFeedback]}
                  onPress={clear}
                  accessibilityRole="button"
                  accessibilityLabel="Vider le panier"
                  accessibilityHint="Demande une confirmation avant de supprimer toute la sélection"
                >
                  <Text style={styles.clearButtonText}>Vider</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#04150F" },
  screen: { flex: 1, backgroundColor: "#04150F" },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 64 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 28,
  },
  brand: {
    color: "#77F0AD",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3.4,
  },
  sectionName: { color: "#EAF8EF", fontSize: 20, fontWeight: "900", marginTop: 7 },
  topButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(119,240,173,0.34)",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(119,240,173,0.06)",
  },
  topButtonText: { color: "#DDF9E8", fontWeight: "900", fontSize: 14 },
  intro: { marginBottom: 22 },
  kicker: {
    color: "#E5B762",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 2.6,
    marginBottom: 11,
  },
  title: {
    color: "#FFF9EC",
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  subtitle: {
    color: "#8EA297",
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 15,
  },
  emptyCard: {
    borderRadius: 34,
    padding: 24,
    backgroundColor: "#EAF9EF",
    overflow: "hidden",
  },
  cardEyebrow: {
    color: "#267C52",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900",
    letterSpacing: 3.3,
  },
  emptyTitle: {
    color: "#062719",
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 14,
  },
  emptyText: {
    color: "#5E7568",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 24,
  },
  orderCard: {
    borderRadius: 30,
    padding: 20,
    backgroundColor: "#F6E8C8",
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  orderHeaderText: { flex: 1 },
  restaurantName: {
    color: "#09291B",
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 10,
  },
  restaurantMeta: { color: "#667367", fontSize: 16, fontWeight: "800", marginTop: 6 },
  itemCountPill: {
    maxWidth: 132,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "rgba(9,41,27,0.09)",
  },
  itemCountText: { color: "#294538", fontSize: 12, fontWeight: "900", textAlign: "center" },
  stepRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
    marginBottom: 22,
  },
  stepActive: { alignItems: "center", gap: 7 },
  stepIdle: { alignItems: "center", gap: 7 },
  stepNumberActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#052719",
    backgroundColor: "#64D69B",
    fontSize: 17,
    fontWeight: "900",
  },
  stepNumberIdle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#708075",
    backgroundColor: "rgba(9,41,27,0.08)",
    fontSize: 17,
    fontWeight: "900",
  },
  stepLabelActive: { color: "#155C3B", fontSize: 12, fontWeight: "900" },
  stepLabelIdle: { color: "#758278", fontSize: 12, fontWeight: "900" },
  stepLine: { flex: 1, height: 3, backgroundColor: "rgba(9,41,27,0.10)", marginHorizontal: 8, marginBottom: 20 },
  itemsList: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 15,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(9,41,27,0.16)",
  },
  itemCopy: { flex: 1 },
  itemTitle: { color: "#09291B", fontSize: 18, fontWeight: "900" },
  itemDescription: { color: "#6C796F", fontSize: 14, lineHeight: 20, marginTop: 4, fontWeight: "600" },
  itemPrice: { color: "#267C52", fontSize: 15, fontWeight: "900", marginTop: 7 },
  quantityBlock: { alignItems: "center", gap: 8 },
  quantityRail: { flexDirection: "row", alignItems: "center", gap: 9 },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A3422",
  },
  quantityButtonText: { color: "#F8F3E5", fontSize: 19, fontWeight: "900" },
  quantity: { minWidth: 18, color: "#09291B", textAlign: "center", fontSize: 17, fontWeight: "900" },
  removeText: { color: "#8B5E3C", fontSize: 12, fontWeight: "900" },
  summaryBlock: {
    borderRadius: 24,
    padding: 17,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: "rgba(9,41,27,0.07)",
  },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  summaryLabel: { color: "#627167", fontSize: 16, fontWeight: "800" },
  summaryValue: { color: "#173B2A", fontSize: 16, fontWeight: "900" },
  totalDivider: { height: 1, backgroundColor: "rgba(9,41,27,0.14)", marginVertical: 7 },
  totalLabel: { color: "#09291B", fontSize: 20, fontWeight: "900" },
  totalValue: { color: "#09291B", fontSize: 25, fontWeight: "900" },
  minimumText: { color: "#A15C38", fontSize: 13, lineHeight: 19, fontWeight: "900", marginTop: 4 },
  minimumReady: { color: "#267C52" },
  primaryButton: {
    minHeight: 58,
    borderRadius: 22,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#082D1E",
  },
  disabledButton: { opacity: 0.46 },
  primaryButtonText: { color: "#FFF7E8", fontSize: 18, fontWeight: "900" },
  primaryArrow: { color: "#70E9A8", fontSize: 29, fontWeight: "700" },
  secondaryPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(119,240,173,0.20)",
    padding: 19,
    marginTop: 16,
    backgroundColor: "#082117",
  },
  secondaryKicker: { color: "#6EE5A4", fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  secondaryTitle: { color: "#EEF9F1", fontSize: 21, lineHeight: 27, fontWeight: "900", marginTop: 8 },
  secondaryActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(119,240,173,0.10)",
  },
  secondaryButtonText: { color: "#DDF9E8", fontSize: 14, fontWeight: "900" },
  clearButton: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(229,183,98,0.28)",
  },
  clearButtonText: { color: "#E5B762", fontSize: 14, fontWeight: "900" },
  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
