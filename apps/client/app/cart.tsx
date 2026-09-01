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
import { getDATheme } from "../ui/da/theme";
import {
  cartItemSummary,
  clearCart,
  decrementCartItem,
  formatCartEuro,
  getCartSnapshot,
  incrementCartItem,
  removeFromCart,
} from "../utils/daCart";

const UI = getDATheme("client");

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
  safe: { flex: 1, backgroundColor: UI.colors.bg0 },
  screen: { flex: 1, backgroundColor: UI.colors.bg0 },
  content: { paddingHorizontal: UI.space.x5, paddingTop: UI.space.x5, paddingBottom: 64 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 28,
  },
  brand: {
    color: UI.colors.accent2,
    fontSize: UI.type.bodySm,
    fontWeight: "900",
    letterSpacing: 3.4,
  },
  sectionName: { color: UI.colors.text, fontSize: UI.type.h3, fontWeight: "900", marginTop: 7 },
  topButton: {
    borderRadius: UI.radius.pill,
    borderWidth: 1,
    borderColor: UI.colors.border,
    paddingHorizontal: UI.space.x4,
    paddingVertical: 11,
    backgroundColor: UI.colors.surface0,
  },
  topButtonText: { color: UI.colors.text2, fontWeight: "900", fontSize: UI.type.bodySm },
  intro: { marginBottom: 22 },
  kicker: {
    color: UI.colors.accent,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: 2.6,
    marginBottom: 11,
  },
  title: {
    color: UI.colors.text,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  subtitle: {
    color: UI.colors.muted,
    fontSize: UI.type.body,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 15,
  },
  emptyCard: {
    borderRadius: 34,
    padding: UI.space.x6,
    backgroundColor: UI.colors.surface0,
    overflow: "hidden",
  },
  cardEyebrow: {
    color: UI.colors.accent2,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "900",
    letterSpacing: 3.3,
  },
  emptyTitle: {
    color: UI.colors.text,
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 14,
  },
  emptyText: {
    color: UI.colors.text2,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: UI.space.x6,
  },
  orderCard: {
    borderRadius: 30,
    padding: UI.space.x5,
    backgroundColor: UI.colors.surface0,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: UI.space.x3,
  },
  orderHeaderText: { flex: 1 },
  restaurantName: {
    color: UI.colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 10,
  },
  restaurantMeta: { color: UI.colors.muted, fontSize: UI.type.body, fontWeight: "800", marginTop: 6 },
  itemCountPill: {
    maxWidth: 132,
    borderRadius: UI.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: UI.colors.surface1,
  },
  itemCountText: { color: UI.colors.text2, fontSize: 12, fontWeight: "900", textAlign: "center" },
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
    color: UI.colors.bg0,
    backgroundColor: UI.colors.success,
    fontSize: 17,
    fontWeight: "900",
  },
  stepNumberIdle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    textAlign: "center",
    textAlignVertical: "center",
    color: UI.colors.muted,
    backgroundColor: UI.colors.surface1,
    fontSize: 17,
    fontWeight: "900",
  },
  stepLabelActive: { color: UI.colors.success, fontSize: 12, fontWeight: "900" },
  stepLabelIdle: { color: UI.colors.muted, fontSize: 12, fontWeight: "900" },
  stepLine: { flex: 1, height: 3, backgroundColor: UI.colors.border, marginHorizontal: UI.space.x2, marginBottom: UI.space.x5 },
  itemsList: {
    borderRadius: UI.radius.xl,
    backgroundColor: UI.colors.surface1,
    paddingHorizontal: 15,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI.space.x3,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.colors.border,
  },
  itemCopy: { flex: 1 },
  itemTitle: { color: UI.colors.text, fontSize: 18, fontWeight: "900" },
  itemDescription: { color: UI.colors.muted, fontSize: UI.type.bodySm, lineHeight: 20, marginTop: UI.space.x1, fontWeight: "600" },
  itemPrice: { color: UI.colors.accent2, fontSize: 15, fontWeight: "900", marginTop: 7 },
  quantityBlock: { alignItems: "center", gap: UI.space.x2 },
  quantityRail: { flexDirection: "row", alignItems: "center", gap: 9 },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.colors.bg1,
  },
  quantityButtonText: { color: UI.colors.text, fontSize: 19, fontWeight: "900" },
  quantity: { minWidth: 18, color: UI.colors.text, textAlign: "center", fontSize: 17, fontWeight: "900" },
  removeText: { color: UI.colors.error, fontSize: 12, fontWeight: "900" },
  summaryBlock: {
    borderRadius: UI.radius.xl,
    padding: 17,
    marginTop: UI.space.x4,
    marginBottom: UI.space.x4,
    backgroundColor: UI.colors.surface1,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  summaryLabel: { color: UI.colors.muted, fontSize: UI.type.body, fontWeight: "800" },
  summaryValue: { color: UI.colors.text2, fontSize: UI.type.body, fontWeight: "900" },
  totalDivider: { height: 1, backgroundColor: UI.colors.border, marginVertical: 7 },
  totalLabel: { color: UI.colors.text, fontSize: UI.type.h3, fontWeight: "900" },
  totalValue: { color: UI.colors.text, fontSize: 25, fontWeight: "900" },
  minimumText: { color: UI.colors.warn, fontSize: UI.type.cap, lineHeight: 19, fontWeight: "900", marginTop: UI.space.x1 },
  minimumReady: { color: UI.colors.accent2 },
  primaryButton: {
    minHeight: 58,
    borderRadius: 22,
    paddingHorizontal: UI.space.x5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: UI.colors.accent,
  },
  disabledButton: { opacity: 0.46 },
  primaryButtonText: { color: UI.colors.bg0, fontSize: 18, fontWeight: "900" },
  primaryArrow: { color: UI.colors.bg0, fontSize: 29, fontWeight: "700" },
  secondaryPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: UI.colors.border,
    padding: 19,
    marginTop: UI.space.x4,
    backgroundColor: UI.colors.bg1,
  },
  secondaryKicker: { color: UI.colors.accent2, fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  secondaryTitle: { color: UI.colors.text, fontSize: 21, lineHeight: 27, fontWeight: "900", marginTop: UI.space.x2 },
  secondaryActions: { flexDirection: "row", gap: 10, marginTop: UI.space.x4 },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: UI.colors.surface1,
  },
  secondaryButtonText: { color: UI.colors.text2, fontSize: UI.type.bodySm, fontWeight: "900" },
  clearButton: {
    borderRadius: 18,
    paddingHorizontal: UI.space.x5,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: UI.colors.border,
  },
  clearButtonText: { color: UI.colors.accent, fontSize: UI.type.bodySm, fontWeight: "900" },
  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
