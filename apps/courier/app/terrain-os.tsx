import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

const c = {
  bg: '#00120F',
  panel: '#001B17',
  panel2: '#062820',
  line: 'rgba(117, 255, 223, 0.34)',
  lineSoft: 'rgba(255,255,255,0.11)',
  cream: '#FFF8EA',
  ink: '#00120F',
  mint: '#E8FFFB',
  mintTile: '#D2F2EF',
  mintStrong: '#66F0AA',
  text: '#FFF8EA',
  muted: 'rgba(255,248,234,0.68)',
  mutedDark: 'rgba(0,18,15,0.50)',
  gold: '#F8C15F',
};

function go(to: string) {
  router.push(to as never);
}

function MetricTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <Pressable style={styles.actionCard} onPress={() => go(to)}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionBody}>{body}</Text>
    </Pressable>
  );
}

export default function TerrainOSScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={styles.orbTop} />
      <View pointerEvents="none" style={styles.orbSide} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.brand}>DELISHAFRICA® COURIER</Text>
          <Text style={styles.heroTitle}>Terrain en 3 secondes.</Text>
          <Text style={styles.heroText}>
            Une mission claire, une route lisible, une action unique. Le coursier sent la précision avant de démarrer.
          </Text>

          <View style={styles.nextBox}>
            <Text style={styles.nextLabel}>PROCHAINE ACTION</Text>
            <Text style={styles.nextValue}>Suivre la mission</Text>
          </View>
        </View>

        <View style={styles.missionCard}>
          <Text style={styles.missionLabel}>MISSION PRIORITAIRE</Text>
          <Text style={styles.missionTitle}>Rice and Peace</Text>
          <Text style={styles.missionMeta}>DA-9P3QH0 · En route · 21,90 €</Text>

          <View style={styles.metricRow}>
            <MetricTile value="A+" label="CLARTÉ" />
            <MetricTile value="15 min" label="ETA" />
            <MetricTile value="Guidé" label="MODE" />
          </View>
        </View>

        <ActionCard title="Route Oracle" body="Voir la meilleure route validable avant départ." to="/route-oracle" />
        <ActionCard title="ETA mission" body="Lire le temps, la distance et la précision terrain." to="/eta-mission" />
        <ActionCard title="Missions" body="Revenir au cockpit opérationnel du coursier." to="/orders" />

        <Text style={styles.footer}>Terrain clair · ETA lisible · action maîtrisée.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 34,
    paddingBottom: 42,
  },
  orbTop: {
    position: 'absolute',
    top: -120,
    right: -130,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: 'rgba(102,240,170,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(102,240,170,0.06)',
  },
  orbSide: {
    position: 'absolute',
    top: 520,
    left: -120,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: 'rgba(117,255,223,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(117,255,223,0.08)',
  },
  hero: {
    borderRadius: 34,
    padding: 26,
    backgroundColor: c.panel,
    borderWidth: 1.2,
    borderColor: c.line,
  },
  brand: {
    color: '#75FFDF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 5.4,
    marginBottom: 34,
  },
  heroTitle: {
    color: c.text,
    fontSize: 42,
    lineHeight: 49,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  heroText: {
    color: c.muted,
    fontSize: 18,
    lineHeight: 30,
    marginTop: 24,
    fontWeight: '500',
  },
  nextBox: {
    marginTop: 28,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#07342D',
    borderWidth: 1.2,
    borderColor: c.line,
  },
  nextLabel: {
    color: 'rgba(255,248,234,0.70)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 5.6,
    marginBottom: 18,
  },
  nextValue: {
    color: c.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  missionCard: {
    marginTop: 26,
    borderRadius: 31,
    padding: 24,
    backgroundColor: c.mint,
  },
  missionLabel: {
    color: '#006D69',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 5.4,
    marginBottom: 22,
  },
  missionTitle: {
    color: c.ink,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  missionMeta: {
    color: 'rgba(0,18,15,0.46)',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '800',
    marginTop: 16,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 34,
  },
  metricTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    backgroundColor: c.mintTile,
    borderWidth: 1,
    borderColor: 'rgba(0,18,15,0.06)',
  },
  metricValue: {
    color: c.ink,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  metricLabel: {
    color: 'rgba(0,18,15,0.62)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 3.6,
    marginTop: 8,
  },
  actionCard: {
    marginTop: 18,
    borderRadius: 25,
    paddingHorizontal: 22,
    paddingVertical: 24,
    minHeight: 126,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: c.lineSoft,
  },
  actionTitle: {
    color: c.text,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  actionBody: {
    color: c.muted,
    fontSize: 17,
    lineHeight: 26,
    marginTop: 13,
    fontWeight: '500',
  },
  footer: {
    color: 'rgba(255,248,234,0.42)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 24,
  },
});
