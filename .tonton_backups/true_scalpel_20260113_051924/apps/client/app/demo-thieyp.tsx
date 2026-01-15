import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me/api/v1";

type DayMenuEntry = {
  day?: string;
  entries: string[];
};

type Partner = {
  id: string;
  name: string;
  tagline?: string;
  country?: string;
  address?: string;
  phone?: string;
  website?: string;
  features?: string[];
  dayMenu?: DayMenuEntry[];
};

export default function DemoThieypScreen() {
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1) Charger la liste complète (pour vérifier /api/partners)
        const resList = await fetch(`${API_BASE_URL}/api/partners`);
        if (!resList.ok) throw new Error('Erreur sur /api/partners');
        const partners: Partner[] = await resList.json();

        // 2) Charger la fiche Thiepy (pour vérifier /api/partners/thieyp)
        const resOne = await fetch(`${API_BASE_URL}/api/partners/thieyp`);
        let thieyp: Partner | null = null;
        if (resOne.ok) {
          thieyp = await resOne.json();
        } else {
          // fallback : chercher dans la liste
          thieyp = partners.find(p => p.id === 'thieyp') ?? null;
        }

        setPartner(thieyp);
      } catch (e: any) {
        setError(e.message ?? 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Chargement de Thiepy…</Text>
      </View>
    );
  }

  if (error || !partner) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Impossible de charger Thiepy</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{partner.name}</Text>
      {partner.tagline && <Text style={styles.subtitle}>{partner.tagline}</Text>}

      <View style={styles.block}>
        {partner.address && <Text style={styles.line}>📍 {partner.address}</Text>}
        {partner.country && <Text style={styles.line}>🌍 {partner.country}</Text>}
        {partner.phone && <Text style={styles.line}>📞 {partner.phone}</Text>}
        {partner.website && <Text style={styles.line}>🔗 {partner.website}</Text>}
      </View>

      {partner.features && partner.features.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Caractéristiques</Text>
          {partner.features.map((f, idx) => (
            <Text key={idx} style={styles.chip}>• {f}</Text>
          ))}
        </View>
      )}

      {partner.dayMenu && partner.dayMenu.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Menus de la semaine</Text>
          {partner.dayMenu.map((m, idx) => (
            <View key={idx} style={styles.menuDay}>
              {m.day && <Text style={styles.day}>{m.day}</Text>}
              {m.entries.map((e, i) => (
                <Text key={i} style={styles.entry}>• {e}</Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
  },
  block: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  line: {
    fontSize: 14,
    marginBottom: 4,
  },
  chip: {
    fontSize: 14,
    marginBottom: 2,
  },
  menuDay: {
    marginTop: 8,
  },
  day: {
    fontWeight: '600',
    marginBottom: 4,
  },
  entry: {
    fontSize: 14,
    marginLeft: 8,
  },
  error: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
  },
});
