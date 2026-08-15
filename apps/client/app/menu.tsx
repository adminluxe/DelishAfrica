import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TastePortrait from "../components/TastePortrait";
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
  isMenuItemOrderableToday,
  menuItemAmount,
  menuItemId,
  restaurantStatusLabel,
  restaurantToCartRestaurant,
} from "../utils/daRestaurantCatalog";

declare const require: any;

const DELISHAFRICA_RESTAURANT_CONTEXT_TRUTH_V1 = true;
const DELISHAFRICA_TASTE_PORTRAITS_V1 = true;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function categoryOf(item: DAApiMenuItem): string {
  return String(item.category || "Menu");
}

function restaurantCity(restaurant: DARestaurant | null): string {
  const value = restaurant as any;
  return String(value?.city || value?.area || value?.country || "Réseau DelishAfrica");
}

function restaurantCuisine(restaurant: DARestaurant | null): string {
  const value = restaurant as any;
  return String(value?.cuisine || value?.cuisines?.[0] || "Cuisine africaine");
}

const THIEYP_IMAGES = {
  chicken: require("../assets/partners/thieyp/thieyp-chicken.jpg"),
  rice: require("../assets/partners/thieyp/thieyp-rice.jpg"),
  menu: require("../assets/partners/thieyp/thieyp-menu-board.jpg"),
};

const LBB_IMAGES = {
  hero: require("../assets/partners/la-boule-bleue/la-boule-bleue-hero.png"),
  cover: require("../assets/partners/la-boule-bleue/la-boule-bleue-cover.png"),
  fish: require("../assets/partners/la-boule-bleue/la-boule-bleue-grilled-fish.png"),
  chicken: require("../assets/partners/la-boule-bleue/la-boule-bleue-chicken.png"),
  mafe: require("../assets/partners/la-boule-bleue/la-boule-bleue-mafe.png"),
};

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function menuDay(item: DAApiMenuItem): string {
  return String((item as any)?.day || "").trim().toLowerCase();
}

function menuAvailabilityLabel(item: DAApiMenuItem): string {
  const serverLabel = String(item.availability?.label || "").trim();
  if (serverLabel) return serverLabel;
  const day = menuDay(item);
  if (!day) return "Disponible tous les jours";
  return `Disponible ${day}`;
}

function currentBrusselsDay(): string {
  try {
    const label = new Intl.DateTimeFormat("fr-BE", {
      weekday: "long",
      timeZone: "Europe/Brussels",
    }).format(new Date());
    return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  } catch {
    return WEEKDAYS[new Date().getDay()] || "";
  }
}

function isThieyp(restaurant: DARestaurant | null, slug: string): boolean {
  const value = restaurant as any;
  return String(value?.slug || slug || "").toLowerCase() === "thieyp" || String(value?.name || "").toLowerCase() === "thieyp";
}

function thieypImageFor(item?: DAApiMenuItem) {
  const text = `${String(item?.name || "")} ${String(item?.description || "")}`.toLowerCase();
  return /(poulet|chicken|yassa|atti[eé]k[eé])/.test(text) ? THIEYP_IMAGES.chicken : THIEYP_IMAGES.rice;
}

function isLaBouleBleue(restaurant: DARestaurant | null, slug: string): boolean {
  const value = restaurant as any;
  const identity = String(value?.slug || slug || "").toLowerCase();
  const name = String(value?.name || "").toLowerCase();
  return identity === "la-boule-bleue" || name === "la boule bleue";
}

function laBouleBleueImageFor(item?: DAApiMenuItem) {
  const text = `${String(item?.name || "")} ${String(item?.description || "")} ${String(item?.category || "")}`.toLowerCase();
  if (/(tilapia|malangwa|thompson|poisson)/.test(text)) return LBB_IMAGES.fish;
  if (/(poulet|chicken|yassa)/.test(text)) return LBB_IMAGES.chicken;
  if (/(arachide|mafé|mafe|mouamb)/.test(text)) return LBB_IMAGES.mafe;
  return LBB_IMAGES.cover;
}

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ restaurantSlug?: string; slug?: string; id?: string }>();
  const slug = useMemo(
    () => firstParam(params.restaurantSlug || params.slug || params.id).trim(),
    [params.restaurantSlug, params.slug, params.id],
  );

  const [restaurant, setRestaurant] = useState<DARestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Préparation de votre escale…");
  const [cartVersion, setCartVersion] = useState(0);

  const cart = useMemo(() => getCartSnapshot(), [cartVersion]);
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];
  const hasCart = cartItems.length > 0;
  const cartSummary = hasCart ? cartItemSummary(cart) : "Panier vide";
  const cartRestaurantName = hasCart
    ? String(cart?.restaurantName || "Restaurant sélectionné")
    : "";

  const load = useCallback(async () => {
    if (!slug) {
      setRestaurant(null);
      setMessage("Choisissez d’abord un restaurant depuis la marketplace.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const next = await fetchRestaurantBySlug(slug);
      setRestaurant(next);
      setMessage(restaurantStatusLabel(next));
    } catch (error) {
      setRestaurant(null);
      setMessage(error instanceof Error ? error.message : "Menu indisponible.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => currentBrusselsDay(), []);
  const visibleMenuItems = useMemo(() => restaurant?.menuItems || [], [restaurant]);

  const groups = useMemo(() => {
    const map = new Map<string, DAApiMenuItem[]>();
    for (const item of visibleMenuItems) {
      const category = categoryOf(item);
      map.set(category, [...(map.get(category) || []), item]);
    }
    return Array.from(map.entries());
  }, [visibleMenuItems]);

  const featuredItems = useMemo(
    () => visibleMenuItems.slice(0, 4),
    [visibleMenuItems],
  );
  const orderable = isRestaurantOrderable(restaurant);

  function refreshCart() {
    setCartVersion((value) => value + 1);
  }

  function openCart() {
    if (!hasCart) {
      setMessage(orderable
        ? "Ajoutez un plat pour ouvrir votre panier."
        : "Les commandes de cette adresse ne sont pas encore ouvertes.");
      return;
    }
    router.push("/cart" as any);
  }

  function addItem(item: DAApiMenuItem) {
    if (!restaurant || !orderable) return;
    if (!isMenuItemOrderableToday(item, today)) {
      Alert.alert(
        "Création programmée",
        `${item.name || "Ce plat"} n’est pas disponible aujourd’hui. ${menuAvailabilityLabel(item)}.`,
      );
      return;
    }

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

  const heroTitle = restaurant?.name || (slug ? "Menu indisponible" : "Choisissez une cuisine");
  const heroDescription = restaurant?.description || (
    slug
      ? "Cette adresse ne peut pas être ouverte pour le moment. Revenez à la marketplace pour poursuivre."
      : "La marketplace vous guide vers une adresse réelle avant d’ouvrir son menu."
  );
  const restaurantSeed = String((restaurant as any)?.slug || restaurant?.name || slug || "delishafrica");

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
        { paddingTop: Math.max(insets.top + 14, 54), paddingBottom: Math.max(insets.bottom + (hasCart ? 112 : 44), hasCart ? 132 : 58) },
      ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#D9AE68" />}
        showsVerticalScrollIndicator={false}
      >
      <StatusBar barStyle="light-content" />

      <View style={styles.topbar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Table partenaire</Text>
        </View>
        <Pressable
          style={[styles.cartTopButton, !hasCart && styles.cartTopButtonEmpty]}
          onPress={openCart}
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasCart }}
          accessibilityLabel={hasCart ? `Ouvrir ${cartSummary}` : "Panier vide"}
        >
          <Text style={[styles.cartTopText, !hasCart && styles.cartTopTextEmpty]}>{hasCart ? cartItems.length : "0"}</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>{orderable ? "TABLE OUVERTE" : "TABLE EN PRÉPARATION"}</Text>
          <Text style={styles.title}>{heroTitle}</Text>
          {restaurant ? (
            <Text style={styles.meta}>{restaurantCity(restaurant)} · {restaurantCuisine(restaurant)}</Text>
          ) : null}
          <Text style={styles.subtitle}>{heroDescription}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, orderable ? styles.statusDotLive : styles.statusDotSoon]} />
            <Text style={styles.message}>{message}</Text>
          </View>
        </View>

        {isThieyp(restaurant, slug) ? (
          <Image source={THIEYP_IMAGES.menu} style={styles.heroImage} resizeMode="cover" accessibilityLabel="Menu officiel Thieyp" />
        ) : isLaBouleBleue(restaurant, slug) ? (
          <Image source={LBB_IMAGES.hero} style={styles.heroImage} resizeMode="cover" accessibilityLabel="La Boule Bleue · Cuisine Belgo-Africaine" />
        ) : (
          <TastePortrait
            name={heroTitle}
            category={restaurantCuisine(restaurant)}
            description={heroDescription}
            seed={restaurantSeed}
            size={112}
            showCode
            style={styles.heroPortrait}
          />
        )}
      </View>

      {restaurant && isThieyp(restaurant, slug) ? (
        <View style={styles.dailyBanner}>
          <View style={styles.dailyDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dailyKicker}>CARTE COMPLÈTE · {today.toUpperCase()}</Text>
            <Text style={styles.dailyTitle}>Toute la carte reste consultable. Chaque création indique son jour de disponibilité.</Text>
          </View>
        </View>
      ) : null}

      {featuredItems.length ? (
        <View style={styles.tasteReelSection}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionKicker}>APERÇU VIVANT</Text>
              <Text style={styles.tasteReelTitle}>Les premières créations.</Text>
            </View>
            <Text style={styles.sectionCount}>{visibleMenuItems.length} créations</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tasteReel}
          >
            {featuredItems.map((item, index) => {
              const itemOrderable = orderable && isMenuItemOrderableToday(item, today);
              return (
                <Pressable
                  key={menuItemId(item, index)}
                  style={({ pressed }) => [styles.tasteReelCard, !itemOrderable && styles.unavailableCard, pressed && itemOrderable && styles.pressFeedback]}
                  onPress={() => addItem(item)}
                  disabled={!itemOrderable}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !itemOrderable }}
                  accessibilityLabel={itemOrderable ? `Ajouter ${item.name || "ce plat"}` : `${item.name || "Plat"}, ${menuAvailabilityLabel(item)}`}
                >
                  {isThieyp(restaurant, slug) ? (
                    <Image source={thieypImageFor(item)} style={styles.tasteReelImage} resizeMode="cover" />
                  ) : isLaBouleBleue(restaurant, slug) ? (
                    <Image source={laBouleBleueImageFor(item)} style={styles.tasteReelImage} resizeMode="cover" />
                  ) : (
                    <TastePortrait
                      name={item.name}
                      category={item.category}
                      description={item.description}
                      seed={restaurantSeed}
                      size={132}
                      style={styles.tasteReelPortrait}
                    />
                  )}
                  <Text style={styles.tasteReelName} numberOfLines={2}>{item.name || "Plat DelishAfrica"}</Text>
                  <Text style={[styles.tasteReelMeta, !itemOrderable && styles.unavailableText]}>{menuAvailabilityLabel(item)} · {formatCartEuro(menuItemAmount(item))}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loading && !restaurant ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#D9AE68" />
          <Text style={styles.loadingText}>Chargement du menu…</Text>
        </View>
      ) : null}

      {restaurant && !orderable ? (
        <View style={styles.lockedCard}>
          <Text style={styles.lockedKicker}>STATUT TRANSPARENT</Text>
          <Text style={styles.lockedTitle}>Ouverture bientôt</Text>
          <Text style={styles.lockedText}>
            Cette table est visible dans le réseau, mais aucune commande ne sera acceptée avant son activation réelle.
          </Text>
        </View>
      ) : null}

      {groups.map(([category, items]) => (
        <View key={category} style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <Text style={styles.sectionCount}>{items.length} création{items.length > 1 ? "s" : ""}</Text>
          </View>

          {items.map((item, index) => {
            const id = menuItemId(item, index);
            const amount = menuItemAmount(item);
            const itemOrderable = orderable && isMenuItemOrderableToday(item, today);
            return (
              <View key={id} style={[styles.itemCard, !itemOrderable && styles.unavailableCard]}>
                {isThieyp(restaurant, slug) ? (
                  <Image source={thieypImageFor(item)} style={styles.itemImage} resizeMode="cover" />
                ) : isLaBouleBleue(restaurant, slug) ? (
                  <Image source={laBouleBleueImageFor(item)} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <TastePortrait
                    name={item.name}
                    category={item.category}
                    description={item.description}
                    seed={restaurantSeed}
                    size={92}
                    compact
                  />
                )}

                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{item.name || "Plat DelishAfrica"}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={3}>{item.description}</Text> : null}
                  <Text style={styles.itemMeta}>{menuAvailabilityLabel(item)} · {formatCartEuro(amount)}</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.addButton,
                    !itemOrderable && styles.disabledButton,
                    pressed && itemOrderable && styles.pressFeedback,
                  ]}
                  disabled={!itemOrderable}
                  onPress={() => addItem(item)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !itemOrderable }}
                  accessibilityLabel={itemOrderable ? `Ajouter ${item.name || "ce plat"}` : menuAvailabilityLabel(item)}
                >
                  <Text style={[styles.addButtonText, !itemOrderable && styles.disabledButtonText]}>{itemOrderable ? "+" : "·"}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      {restaurant && groups.length === 0 ? (
        <View style={styles.lockedCard}>
          <Text style={styles.lockedKicker}>CARTE EN CONSTRUCTION</Text>
          <Text style={styles.lockedTitle}>Menu en préparation</Text>
          <Text style={styles.lockedText}>Les créations de ce partenaire apparaîtront après validation.</Text>
        </View>
      ) : null}

      {!restaurant && !loading ? (
        <Pressable style={styles.marketplaceButton} onPress={() => router.push("/restaurants" as any)}>
          <Text style={styles.marketplaceButtonText}>Revenir à la Marketplace</Text>
          <Text style={styles.marketplaceButtonArrow}>→</Text>
        </Pressable>
      ) : null}

      </ScrollView>

      {hasCart ? (
        <View style={[styles.cartDock, { bottom: Math.max(insets.bottom + 12, 22) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartLabel}>VOTRE COMMANDE</Text>
            <Text style={styles.cartTitle}>{cartSummary}</Text>
            <Text style={styles.cartText}>{cartRestaurantName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.cartButton, pressed && styles.pressFeedback]}
            onPress={openCart}
            accessibilityRole="button"
            accessibilityLabel={`Voir le panier de ${cartRestaurantName}`}
          >
            <Text style={styles.cartButtonText}>Voir</Text>
            <Text style={styles.cartButtonArrow}>→</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07130E" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  backButtonText: { color: "#FFF8EA", fontSize: 23, fontWeight: "800", marginTop: -2 },
  brand: { color: "#D9AE68", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  role: { color: "rgba(255,248,234,0.46)", fontSize: 10, fontWeight: "700", marginTop: 4 },
  cartTopButton: { minWidth: 44, height: 44, borderRadius: 99, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#D9AE68" },
  cartTopButtonEmpty: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cartTopText: { color: "#17251C", fontSize: 12, fontWeight: "900" },
  cartTopTextEmpty: { color: "rgba(255,248,234,0.34)" },
  hero: { position: "relative", overflow: "hidden", borderRadius: 34, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "#102219", borderWidth: 1, borderColor: "rgba(217,174,104,0.20)" },
  heroCopy: { flex: 1, minWidth: 0 },
  heroPortrait: { flexShrink: 0 },
  heroImage: { width: 112, height: 112, borderRadius: 26, flexShrink: 0, borderWidth: 1, borderColor: "rgba(217,174,104,0.34)" },
  dailyBanner: { marginTop: 18, borderRadius: 22, padding: 15, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "rgba(117,215,157,0.09)", borderWidth: 1, borderColor: "rgba(117,215,157,0.24)" },
  dailyDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#75D79D" },
  dailyKicker: { color: "#75D79D", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  dailyTitle: { color: "#FFF8EA", fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 4 },
  kicker: { color: "#D9AE68", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: "#FFF8EA", fontSize: 28, lineHeight: 33, fontWeight: "900", marginTop: 8 },
  meta: { color: "#C99864", fontSize: 10, lineHeight: 15, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "rgba(255,248,234,0.56)", fontSize: 11, lineHeight: 17, marginTop: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 99 },
  statusDotLive: { backgroundColor: "#75D79D", shadowColor: "#75D79D", shadowOpacity: 0.75, shadowRadius: 6 },
  statusDotSoon: { backgroundColor: "#D9AE68" },
  message: { flex: 1, color: "rgba(255,248,234,0.48)", fontSize: 9, lineHeight: 14, fontWeight: "800" },
  tasteReelSection: { marginTop: 24 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  sectionKicker: { color: "#B77A4C", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  tasteReelTitle: { color: "#FFF8EA", fontSize: 22, lineHeight: 27, fontWeight: "900", marginTop: 6 },
  sectionCount: { color: "rgba(255,248,234,0.34)", fontSize: 8, fontWeight: "900", marginBottom: 4 },
  tasteReel: { gap: 10, paddingRight: 18, paddingBottom: 4 },
  tasteReelCard: { width: 146, borderRadius: 24, padding: 8, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  tasteReelPortrait: { alignSelf: "center" },
  tasteReelImage: { width: 130, height: 116, borderRadius: 18, alignSelf: "center" },
  tasteReelName: { color: "#FFF8EA", fontSize: 11, lineHeight: 15, fontWeight: "900", marginTop: 9, minHeight: 30 },
  tasteReelMeta: { color: "#D9AE68", fontSize: 10, fontWeight: "900", marginTop: 5 },
  loadingCard: { padding: 24, borderRadius: 24, backgroundColor: "#102219", alignItems: "center", marginTop: 18 },
  loadingText: { color: "rgba(255,248,234,0.58)", marginTop: 10, fontWeight: "800" },
  lockedCard: { borderRadius: 28, padding: 20, backgroundColor: "#F1E4CA", marginTop: 18 },
  lockedKicker: { color: "#7D4C2B", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  lockedTitle: { color: "#17251C", fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 8 },
  lockedText: { color: "rgba(23,37,28,0.64)", fontSize: 12, lineHeight: 19, marginTop: 8 },
  section: { marginTop: 26 },
  sectionTitle: { color: "#FFF8EA", fontSize: 24, lineHeight: 29, fontWeight: "900" },
  itemCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 25, padding: 10, paddingRight: 12, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 10 },
  itemImage: { width: 92, height: 92, borderRadius: 20, flexShrink: 0 },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: "#FFF8EA", fontSize: 15, lineHeight: 19, fontWeight: "900" },
  itemDescription: { color: "rgba(255,248,234,0.50)", fontSize: 10, lineHeight: 15, marginTop: 5 },
  itemMeta: { color: "#D9AE68", fontSize: 11, marginTop: 7, fontWeight: "900" },
  addButton: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#D9AE68" },
  addButtonText: { color: "#17251C", fontSize: 22, fontWeight: "800", marginTop: -2 },
  unavailableCard: { opacity: 0.48 },
  unavailableText: { color: "rgba(255,248,234,0.38)" },
  disabledButton: { backgroundColor: "rgba(255,255,255,0.06)" },
  disabledButtonText: { color: "rgba(255,248,234,0.30)" },
  marketplaceButton: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 16, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#D9AE68" },
  marketplaceButtonText: { color: "#17251C", fontSize: 13, fontWeight: "900" },
  marketplaceButtonArrow: { color: "#17251C", fontSize: 20, fontWeight: "900" },
  cartDock: { position: "absolute", left: 18, right: 18, borderRadius: 26, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#102219", borderWidth: 1, borderColor: "rgba(217,174,104,0.38)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  cartLabel: { color: "#D9AE68", fontWeight: "900", letterSpacing: 1.4, fontSize: 8 },
  cartTitle: { color: "#FFF8EA", fontSize: 16, fontWeight: "900", marginTop: 3 },
  cartText: { color: "rgba(255,248,234,0.48)", fontSize: 9, fontWeight: "700", marginTop: 3 },
  cartButton: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#D9AE68" },
  cartButtonText: { color: "#17251C", fontSize: 11, fontWeight: "900" },
  cartButtonArrow: { color: "#17251C", fontSize: 16, fontWeight: "900" },
  pressFeedback: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
