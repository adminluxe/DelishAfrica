import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getTheme } from '../ui/theme';

export default function MenuScreen() {
  const t = getTheme('client');

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.bg }]}>
      <Text style={[styles.kicker, { color: t.colors.accent }]}>RESTAURANT • DÉMO</Text>
      <Text style={[styles.h1, { color: t.colors.text }]}>Menu Thieyp</Text>
      <Text style={[styles.p, { color: t.colors.subtext }]}>
        Placeholder Phase 2A. Prochaine étape : items + panier + total.
      </Text>

      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Text style={[styles.item, { color: t.colors.text }]}>• Thieyp Poulet</Text>
        <Text style={[styles.item, { color: t.colors.text }]}>• Thieyp Poisson</Text>
        <Text style={[styles.item, { color: t.colors.text }]}>• Jus bissap</Text>

        <Pressable
          onPress={() => router.back()}
          style={[styles.btnGhost, { borderColor: t.colors.border }]}
        >
          <Text style={[styles.btnText, { color: t.colors.text }]}>Retour</Text>
        </Pressable>
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
  item: { fontSize: 16, marginBottom: 8, fontWeight: '700' },
  btnGhost: { marginTop: 14, paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '800' },
});
