#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup_phase2a_routes_$TS"
mkdir -p "$BACKUP"

echo "== DelishAfrica | Phase 2A | Routes bootstrap =="
echo "Backup: $BACKUP"
echo

backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    mkdir -p "$BACKUP/$(dirname "$file")"
    cp -a "$file" "$BACKUP/$file"
  fi
}

write_file() {
  local file="$1"
  local content="$2"
  mkdir -p "$(dirname "$file")"
  backup_file "$file"
  cat > "$file" <<EOF
$content
EOF
}

# -----------------------------
# CLIENT ROUTES: /orders + /menu
# -----------------------------
write_file "apps/client/app/orders.tsx" \
"import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getTheme } from '../ui/theme';

export default function OrdersScreen() {
  const t = getTheme('client');

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.bg }]}>
      <Text style={[styles.kicker, { color: t.colors.accent }]}>COMMANDE • DÉMO</Text>
      <Text style={[styles.h1, { color: t.colors.text }]}>Commande Thieyp</Text>
      <Text style={[styles.p, { color: t.colors.subtext }]}>
        Écran Phase 2A : création et suivi local (sans backend complexe).
      </Text>

      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Text style={[styles.cardTitle, { color: t.colors.text }]}>Étapes</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>1) Créer la commande</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>2) Restaurant accepte</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>3) Pick-up</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>4) Livré</Text>

        <View style={styles.row}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.btnGhost, { borderColor: t.colors.border }]}
          >
            <Text style={[styles.btnText, { color: t.colors.text }]}>Retour</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/menu')}
            style={[styles.btn, { backgroundColor: t.colors.primary }]}
          >
            <Text style={[styles.btnText, { color: '#0B0B0B' }]}>Voir menu</Text>
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
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  btnGhost: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '800' },
});"

write_file "apps/client/app/menu.tsx" \
"import React from 'react';
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
});"

# -----------------------------
# MERCHANT ROUTE: /ops
# -----------------------------
write_file "apps/merchant/app/ops.tsx" \
"import React from 'react';
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
});"

# -----------------------------
# COURIER ROUTE: /mission
# -----------------------------
write_file "apps/courier/app/mission.tsx" \
"import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getTheme } from '../ui/theme';

export default function MissionScreen() {
  const t = getTheme('courier');

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.bg }]}>
      <Text style={[styles.kicker, { color: t.colors.accent }]}>MISSION • DÉMO</Text>
      <Text style={[styles.h1, { color: t.colors.text }]}>Livraison Thieyp</Text>
      <Text style={[styles.p, { color: t.colors.subtext }]}>
        Écran Phase 2A : pick-up ➜ livré (local, rapide, propre).
      </Text>

      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Text style={[styles.cardTitle, { color: t.colors.text }]}>Étapes</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>• Pick-up</Text>
        <Text style={[styles.item, { color: t.colors.subtext }]}>• Livré</Text>

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
            <Text style={[styles.btnText, { color: '#0B0B0B' }]}>Pick-up</Text>
          </Pressable>

          <Pressable
            onPress={() => {}}
            style={[styles.btnGhost, { borderColor: t.colors.border }]}
          >
            <Text style={[styles.btnText, { color: t.colors.text }]}>Terminer</Text>
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
});"

echo "== DONE =="
echo "Backup saved at: $BACKUP"
echo
echo "Routes created:"
echo "  [client]   /orders  /menu"
echo "  [merchant] /ops"
echo "  [courier]  /mission"
echo
echo "Next: press 'r' in the 3 Metro windows"
