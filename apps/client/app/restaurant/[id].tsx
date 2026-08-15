// DA_J8UX_S1A1_DISCOVERY_RESTAURANT_MENU_CANONICALIZATION
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  DARestaurant,
  fetchRestaurantBySlug,
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
      setRestaurant(null);
      setMessage(error instanceof Error ? error.message : "Restaurant indisponible.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderable = isRestaurantOrderable(restaurant);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.brand}>DELISHAFRICA®</Text>
      <DAHeader
        app="client"
        title={restaurant?.name || (loading ? "Restaurant" : "Adresse indisponible")}
        subtitle={restaurant?.descriptionLong || restaurant?.description || "Une table partenaire du réseau DelishAfrica®."}
      />

      {loading && !restaurant ? (
        <GlassCard app="client">
          <View style={styles.loadingRow}>
            <ActivityIndicator color={T.colors.accent2} />
            <Text style={styles.loadingText}>Ouverture de la table…</Text>
          </View>
        </GlassCard>
      ) : null}

      {restaurant ? (
        <View style={styles.stack}>
          <GlassCard app="client">
            <View style={styles.statusRow}>
              <StatusPill app="client" status={orderable ? "ONLINE" : "IDLE"} label={message} />
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Cuisine</Text>
              <Text style={styles.infoValue}>{restaurant.cuisine || restaurant.cuisines.join(", ") || "Africaine"}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{restaurant.address || [restaurant.area, restaurant.city].filter(Boolean).join(" · ") || "Bruxelles"}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Zone de livraison</Text>
              <Text style={styles.infoValue}>{restaurant.delivery.serviceAreaLabel || "Bruxelles"}</Text>
            </View>
            {restaurant.phone ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>{restaurant.phone}</Text>
              </View>
            ) : null}
          </GlassCard>

          <DAInlineNotice
            app="client"
            kind={orderable ? "success" : "info"}
            title={orderable ? "Cette table prend des commandes" : "Cette table prépare son ouverture"}
            body={orderable ? "Consultez la carte, composez votre panier puis poursuivez vers le paiement sécurisé." : "La fiche reste consultable pendant la préparation de son ouverture aux commandes."}
          />

          <DAButton
            app="client"
            label={orderable ? "Ouvrir le menu" : "Ouverture bientôt"}
            disabled={!orderable}
            onPress={() => router.push({ pathname: "/menu", params: { restaurantSlug: restaurant.slug } } as any)}
          />
          <DAButton app="client" label="Retour aux restaurants" variant="secondary" onPress={() => router.push("/restaurants" as any)} />
        </View>
      ) : !loading ? (
        <View style={styles.stack}>
          <DAInlineNotice app="client" kind="warn" title="Restaurant introuvable" body={message} />
          <DAButton app="client" label="Retour aux restaurants" variant="secondary" onPress={() => router.push("/restaurants" as any)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.colors.bg0 },
  content: { paddingHorizontal: T.space.x5, paddingTop: 72, paddingBottom: 52 },
  brand: { color: T.colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, marginBottom: T.space.x3 },
  stack: { gap: T.space.x4 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: T.space.x3 },
  loadingText: { color: T.colors.text2, fontWeight: "700" },
  statusRow: { marginBottom: T.space.x5 },
  infoBlock: { borderTopWidth: 1, borderTopColor: T.colors.border, paddingTop: T.space.x3, marginTop: T.space.x3 },
  infoLabel: { color: T.colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginBottom: T.space.x1 },
  infoValue: { color: T.colors.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
});
