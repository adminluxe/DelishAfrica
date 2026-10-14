/**
 * DelishAfrica — read-only partner finance screen, 14/10/2026.
 * NO LIVE MONEY until signed OIDC + financial authority are proven.
 * A synthetic QA display is only possible in an explicitly-enabled dev build.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  readFinanceForCurrentIdentity,
  type FinanceState,
} from '../utils/daFinanceReadOnly';

const COLORS = {
  background: '#061610',
  panel: '#0A241C',
  tint: '#67E2B8',
  text: '#FFF7E9',
  muted: '#B8B6AE',
  border: 'rgba(255,255,255,0.12)',
  warning: '#F3B86E',
} as const;
const UNAVAILABLE: FinanceState = {
  status: 'unavailable',
  reason: 'not_certified',
};

function euro(minor: number): string {
  return (minor / 100).toFixed(2).replace('.', ',') + ' €';
}
export default function PartnerFinanceScreen() {
  const [finance, setFinance] = useState<FinanceState>(UNAVAILABLE);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    // Never use persisted/previous-account wallet values while identity rotates.
    setFinance(UNAVAILABLE);
    const next = await readFinanceForCurrentIdentity();
    setFinance(next);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    setFinance(UNAVAILABLE);
    setLoading(true);
    void readFinanceForCurrentIdentity().then(value => {
      if (active) setFinance(value);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; setFinance(UNAVAILABLE); };
  }, []));

  const isQa = finance.status === 'qa';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()}>
          <Text style={styles.back}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.eyebrow}>DELISHAFRICA® · LIVREUR</Text>
        <Text style={styles.title}>Mes gains</Text>
        <Text style={styles.intro}>Les gains liés à mes livraisons</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>AUTORITÉ FINANCIÈRE</Text>
          <Text style={styles.heroTitle}>
            {loading ? 'Vérification…' : isQa ? 'Simulation isolée' : 'Accès en préparation'}
          </Text>
          {loading ? <ActivityIndicator color={COLORS.tint} style={styles.spinner} /> : null}
          <Text style={styles.heroDescription}>
            {isQa
              ? 'Données de test fictives : elles ne représentent aucun revenu ou solde réel.'
              : 'Aucun montant affiché sans identité vérifiée, droits métier et registre financier autoritatif.'}
          </Text>
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {isQa ? 'QA SYNTHÉTIQUE — NON RETIRABLE' : 'FINANCES RÉELLES — NON ACTIVÉES'}
            </Text>
          </View>
        </View>

        {finance.status === 'qa' ? (
          <View style={styles.cards}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Total test comptabilisé</Text>
              <Text style={styles.amount}>{euro(finance.accruedMinor)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>En attente · test</Text>
              <Text style={styles.amount}>{euro(finance.pendingMinor)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Disponible · test uniquement</Text>
              <Text style={styles.amount}>{euro(finance.availableMinor)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Retenu · test</Text>
              <Text style={styles.amount}>{euro(finance.heldMinor)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Votre sécurité avant les chiffres.</Text>
            <Text style={styles.noticeText}>
              L'accès aux comptes sera ouvert uniquement après la validation de votre
              identité, de vos habilitations et de la source comptable.
              Aucun zéro fictif ne remplace une donnée indisponible.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Retraits et virements</Text>
          <Text style={styles.footerText}>Désactivés. Aucun mouvement bancaire n'est possible depuis cet écran.</Text>
        </View>
        <Pressable style={styles.refresh} onPress={() => void load()} accessibilityRole="button" disabled={loading}>
          <Text style={styles.refreshLabel}>{loading ? 'Contrôle en cours…' : 'Actualiser mon statut'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 22, paddingVertical: 26, paddingBottom: 60, gap: 16 },
  back: { color: COLORS.tint, fontWeight: '800', fontSize: 14, marginBottom: 10 },
  eyebrow: { color: COLORS.tint, letterSpacing: 2.4, fontWeight: '900', fontSize: 10 },
  title: { color: COLORS.text, fontSize: 39, letterSpacing: -1.3, fontWeight: '900' },
  intro: { color: COLORS.muted, fontSize: 14 },
  hero: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 28, padding: 24, gap: 14 },
  heroLabel: { color: COLORS.tint, letterSpacing: 2, fontWeight: '900', fontSize: 10 },
  heroTitle: { color: COLORS.text, fontWeight: '900', fontSize: 26 },
  heroDescription: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  spinner: { alignSelf: 'flex-start' },
  statusBar: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8, borderColor: COLORS.border, borderWidth: 1 },
  statusText: { color: COLORS.warning, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', borderRadius: 20, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, padding: 16, minHeight: 100 },
  cardLabel: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  amount: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 8 },
  notice: { padding: 22, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22 },
  noticeTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900' },
  noticeText: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  footer: { padding: 18, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18 },
  footerTitle: { color: COLORS.tint, fontSize: 13, fontWeight: '900' },
  footerText: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  refresh: { borderRadius: 20, borderWidth: 1, borderColor: COLORS.tint, padding: 15, alignItems: 'center' },
  refreshLabel: { color: COLORS.tint, fontWeight: '900', fontSize: 13 },
});
