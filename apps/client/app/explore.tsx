import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

type Partner = {
  id?: string;
  name?: string;
  slug?: string;
  city?: string;
  cuisine?: string;
  status?: string;
  description?: string;
  address?: string;
  rating?: number;
};

const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me").replace(/\/$/, "");

async function fetchPartners(): Promise<Partner[]> {
  const url = API_BASE.endsWith("/api/v1") || API_BASE.endsWith("/api")
    ? `${API_BASE.replace(/\/api\/v1$/, "").replace(/\/api$/, "")}/api/partners`
    : `${API_BASE}/api/partners`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalogue partenaires indisponible (${res.status}).`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : [];
  return items.filter((partner) =>
    !["placeholder", "demo", "test", "draft", "internal"].includes(
      String(partner?.status || "").trim().toLowerCase(),
    ),
  );
}

export default function ExploreScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPartners()
      .then(setPartners)
      .catch((err) => setError(err?.message || "Synchronisation indisponible."));
  }, []);

  const thieyp = partners.find((p) => p.slug === "thieyp");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA · EXPLORE</Text>
        <Text style={styles.title}>Partenaires & menus</Text>
        <Text style={styles.subtitle}>
          Les informations affichées proviennent des fiches partenaires synchronisées. Une donnée absente reste à confirmer plutôt que d’être inventée.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {thieyp ? (
        <Pressable
          style={styles.featured}
          onPress={() =>
            router.push({
              pathname: "/menu",
              params: { restaurantSlug: thieyp.slug || "thieyp" },
            } as any)
          }
        >
          <Text style={styles.badge}>PARTENAIRE</Text>
          <Text style={styles.cardTitle}>{thieyp.name || "Partenaire DelishAfrica®"}</Text>
          <Text style={styles.cardText}>{thieyp.address || "Adresse en cours de confirmation par le partenaire."}</Text>
          <Text style={styles.cardText}>{thieyp.description || "Menu et informations synchronisés depuis la fiche partenaire."}</Text>
          <Text style={styles.link}>Voir le menu réel →</Text>
        </Pressable>
      ) : null}

      {partners.filter((p) => p.slug !== "thieyp").map((p) => {
        const context = [p.cuisine, p.city].filter(Boolean).join(" · ");
        return (
          <View key={p.slug || p.id || p.name} style={styles.card}>
            <Text style={styles.placeholder}>PARTENAIRE DELISHAFRICA®</Text>
            <Text style={styles.cardTitle}>{p.name || "Partenaire à confirmer"}</Text>
            <Text style={styles.cardText}>{context || "Informations en cours de validation par le partenaire."}</Text>
            <Text style={styles.cardText}>{p.description || "Présentation en cours de validation par le partenaire."}</Text>
          </View>
        );
      })}

      <Pressable style={styles.cta} onPress={() => router.push("/" as any)}>
        <Text style={styles.ctaText}>Retour à la marketplace</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070B1A" },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#111936",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  kicker: { color: "#F5BE6B", fontSize: 12, fontWeight: "900", letterSpacing: 2.5, marginBottom: 10 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "rgba(255,255,255,0.75)", fontSize: 16, lineHeight: 23 },
  featured: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#FFF6DF",
    borderWidth: 1,
    borderColor: "rgba(245,190,107,0.55)",
  },
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  badge: { color: "#126D3A", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  placeholder: { color: "#F5BE6B", fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  cardTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginBottom: 8 },
  cardText: { color: "rgba(255,255,255,0.74)", fontSize: 14, lineHeight: 20, marginTop: 2 },
  link: { color: "#101010", fontSize: 15, fontWeight: "900", marginTop: 12 },
  cta: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F5BE6B" },
  ctaText: { color: "#101010", fontSize: 16, fontWeight: "900" },
  error: { color: "#FFB6B6", fontWeight: "800" },
});
