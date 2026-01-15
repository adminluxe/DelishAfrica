import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getTheme } from '../ui/theme';

export default function OpsScreen() {
  const t = getTheme('merchant');

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.bg }]}>
      <Text style={[styles.kicker, { color: t.colors.accent }]}>OPÉRATION • DÉMO</Text>
      <Text style={[styles.h1, { color: t.colors.text }]}>File entrante</Text>
      <Text style={[styles.p, { color: t.colors.subtext }]}>
        Écran Phase 2A : accepter ➜ préparer ➜ prêt.
      </Text>

      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Text style={[styles.cardTitle, { color: t.colors.text }]}>Commande</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>• Thieyp (démo)</Text>

        <View style={styles.row}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.btnGhost, { borderColor: t.colors.border }]}
          >
            <Text style={[styles.btnText, { color: t.colors.text }]}>Retour</Text>
          </Pressable>

          <Pressable
            onPress={() => {}}
            style={[styles.btn, { backgroundColor: t.colors.primary }]}
          >
            <Text style={[styles.btnText, { color: '#0B0B0B' }]}>Accepter</Text>
          </Pressable>

          <Pressable
            onPress={() => {}}
            style={[styles.btnGhost, { borderColor: t.colors.border }]}
          >
            <Text style={[styles.btnText, { color: t.colors.text }]}>Marquer prêt</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18 },
  kicker: { fontSize: 12, letterSpacing: 3, fontWeight: '700', marginTop: 10, marginBottom: 10 },
  h1: { fontSize: 40, fontWeight: '800', lineHeight: 44, marginBottom: 10 },
  p: { fontSize: 16, lineHeight: 22, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  item: { fontSize: 15, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center' },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  btnText: { fontSize: 15, fontWeight: '800' },
});
