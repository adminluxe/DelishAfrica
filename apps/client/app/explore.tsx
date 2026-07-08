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
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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
          Thieyp est branché avec ses informations réelles. De nouveaux partenaires rejoignent progressivement la sélection DelishAfrica.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {thieyp ? (
        <Pressable style={styles.featured} onPress={() => router.push("/menu" as any)}>
          <Text style={styles.badge}>ACTIF</Text>
          <Text style={styles.cardTitle}>{thieyp.name}</Text>
          <Text style={styles.cardText}>{thieyp.address || "Rue Longue Vie 46, 1050 Ixelles"}</Text>
          <Text style={styles.cardText}>Menu : Rice and Peace, attiéké, yassa, mafé, bissap.</Text>
          <Text style={styles.link}>Voir le menu →</Text>
        </Pressable>
      ) : null}

      {partners.filter((p) => p.slug !== "thieyp").map((p) => (
        <View key={p.slug || p.name} style={styles.card}>
          <Text style={styles.placeholder}>PARTENAIRE EN PREPARATION</Text>
          <Text style={styles.cardTitle}>{p.name}</Text>
          <Text style={styles.cardText}>{p.cuisine || "Cuisine afro-diasporique"} · {p.city || "Bruxelles"}</Text>
          <Text style={styles.cardText}>{p.description || "Préparé pour tester listes, filtres et navigation."}</Text>
        </View>
      ))}

      <Pressable style={styles.cta} onPress={() => router.push("/menu" as any)}>
        <Text style={styles.ctaText}>Ouvrir le menu Thieyp</Text>
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
