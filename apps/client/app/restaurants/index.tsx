// DA_J8UX_S1A1_DISCOVERY_RESTAURANT_MENU_CANONICALIZATION
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { DAButton } from "../../ui/da/DAButton";
import { DAHeader } from "../../ui/da/DAHeader";
import { DAInlineNotice } from "../../ui/da/DAInlineNotice";
import { GlassCard } from "../../ui/da/GlassCard";
import { StatusPill } from "../../ui/da/StatusPill";
import { getDATheme } from "../../ui/da/theme";

const T = getDATheme("client");

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
    void load();
  }, [load]);

  function openRestaurant(restaurant: DARestaurant) {
    router.push({ pathname: "/restaurant/[id]", params: { id: restaurant.slug } } as any);
  }

  function openMenu(restaurant: DARestaurant) {
    if (!isRestaurantOrderable(restaurant)) return;
    router.push({ pathname: "/menu", params: { restaurantSlug: restaurant.slug } } as any);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={T.colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <DAHeader
          app="client"
          title="Restaurants"
          subtitle="Des tables partenaires réelles, une seule trajectoire : découvrir, comprendre, puis commander."
        />
        <DAInlineNotice
          app="client"
          kind={loading ? "info" : restaurants.length ? "success" : "warn"}
          title={loading ? "Synchronisation du catalogue" : "Catalogue synchronisé"}
          body={message}
        />
      </View>

      {loading && restaurants.length === 0 ? (
        <GlassCard app="client">
          <View style={styles.loadingRow}>
            <ActivityIndicator color={T.colors.accent2} />
            <Text style={styles.loadingText}>Chargement du catalogue…</Text>
          </View>
        </GlassCard>
      ) : null}

      <View style={styles.list}>
        {restaurants.map((restaurant) => {
          const orderable = isRestaurantOrderable(restaurant);
          const location = [restaurant.area, restaurant.city].filter(Boolean).join(" · ") || "Bruxelles";
          return (
            <GlassCard app="client" key={restaurant.slug}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardKicker}>{restaurant.cuisine || restaurant.cuisines[0] || "Cuisine africaine"}</Text>
                  <Text style={styles.cardTitle}>{restaurant.name}</Text>
                  <Text style={styles.location}>{location}</Text>
                </View>
                <StatusPill
                  app="client"
                  status={orderable ? "ONLINE" : "IDLE"}
                  label={orderable ? "Commandes ouvertes" : "Bientôt"}
                />
              </View>

              <Text style={styles.description}>{restaurant.description || "Partenaire DelishAfrica en préparation."}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.meta}>{restaurant.rating ? `★ ${restaurant.rating}` : "★ Nouveau"}</Text>
                <Text style={styles.meta}>{restaurant.delivery.serviceAreaLabel || "Bruxelles"}</Text>
                <Text style={styles.meta}>{restaurantStatusLabel(restaurant)}</Text>
              </View>

              <View style={styles.actions}>
                <View style={styles.actionGrow}>
                  <DAButton app="client" label="Découvrir la table" variant="secondary" onPress={() => openRestaurant(restaurant)} />
                </View>
                <View style={styles.actionGrow}>
                  <DAButton
                    app="client"
                    label={orderable ? "Voir le menu" : "Ouverture bientôt"}
                    onPress={() => openMenu(restaurant)}
                    disabled={!orderable}
                  />
                </View>
              </View>
            </GlassCard>
          );
        })}
      </View>

      <GlassCard app="client">
        <Text style={styles.footerTitle}>Une commande, une table</Text>
        <Text style={styles.footerText}>
          Le panier reste mono-restaurant pour préserver une préparation lisible et une livraison cohérente.
        </Text>
        <View style={styles.footerAction}>
          <DAButton app="client" label="Voir les zones de livraison" variant="ghost" onPress={() => router.push("/delivery-zones" as any)} />
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.colors.bg0 },
  content: { paddingHorizontal: T.space.x5, paddingTop: 72, paddingBottom: 52 },
  hero: { marginBottom: T.space.x5 },
  brand: { color: T.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, marginBottom: T.space.x3 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: T.space.x3 },
  loadingText: { color: T.colors.text2, fontWeight: "700" },
  list: { gap: T.space.x4, marginBottom: T.space.x4 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: T.space.x3, marginBottom: T.space.x4 },
  cardCopy: { flex: 1 },
  cardKicker: { color: T.colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: T.space.x1 },
  cardTitle: { color: T.colors.text, fontSize: 24, lineHeight: 29, fontWeight: "900" },
  location: { color: T.colors.text2, marginTop: T.space.x1, fontWeight: "700" },
  description: { color: T.colors.text2, lineHeight: 21, marginBottom: T.space.x4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: T.space.x2, marginBottom: T.space.x4 },
  meta: { color: T.colors.text, backgroundColor: T.colors.surface1, borderColor: T.colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: T.radius.pill, fontWeight: "800", fontSize: 12 },
  actions: { flexDirection: "row", gap: T.space.x2 },
  actionGrow: { flex: 1 },
  footerTitle: { color: T.colors.text, fontSize: 18, fontWeight: "900", marginBottom: T.space.x2 },
  footerText: { color: T.colors.text2, lineHeight: 20 },
  footerAction: { marginTop: T.space.x4 },
});
