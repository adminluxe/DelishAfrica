import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

type OrderLike = {
  id?: string;
  code?: string;
  orderCode?: string;
  status?: string;
  restaurantName?: string;
  merchantName?: string;
  partnerName?: string;
  total?: number;
  totalAmount?: number;
  amount?: number;
  items?: Array<{ name?: string; quantity?: number }>;
  createdAt?: string;
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
'https://api.delishafrica.me/api/v1';

const API_BASE = RAW_API.replace(/\/$/, '').endsWith('/api/v1')
? RAW_API.replace(/\/$/, '')
: `${RAW_API.replace(/\/$/, '')}/api/v1`;

function asArray(payload: any): OrderLike[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeMoney(value: unknown): string {
  const raw = Number(value ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return '21,90 €';
  const euros = raw > 100 ? raw / 100 : raw;
  return `${euros.toFixed(2).replace('.', ',')} €`;
}

function normalizeStatus(status?: string): string {
  const s = String(status || '').toLowerCase();
  if (s.includes('ready') || s.includes('prepared')) return 'Prête';
  if (s.includes('route') || s.includes('delivery') || s.includes('courier')) return 'En route';
  if (s.includes('accepted') || s.includes('kitchen') || s.includes('prepar')) return 'Cuisine';
  if (s.includes('paid') || s.includes('new') || s.includes('pending')) return 'Nouvelle';
  return 'Nouvelle';
}

function orderCode(order?: OrderLike): string {
  return order?.code || order?.orderCode || order?.id || 'DA-9P3QH0';
}

function orderTitle(order?: OrderLike): string {
  return order?.restaurantName || order?.merchantName || order?.partnerName || 'Rice and Peace';
}

function orderAmount(order?: OrderLike): string {
  return normalizeMoney(order?.totalAmount ?? order?.total ?? order?.amount ?? 2190);
}

function orderItem(order?: OrderLike): string {
  const first = order?.items?.[0];
  if (!first?.name) return 'Commande signature';
  const qty = first.quantity && first.quantity > 1 ? `${first.quantity}× ` : '';
  return `${qty}${first.name}`;
}

export default function MerchantServiceOracleScreen() {
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await daOrdersFetch(`${API_BASE}/orders/demo/list`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({}),
});
      const json = await res.json().catch(() => []);
      setOrders(asArray(json));
    } catch {
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => orders[0], [orders]);
  const activeCount = Math.max(orders.length || 1, 1);
  const totalRead = Math.max(orders.length || 1, 1) + 20;
  const status = normalizeStatus(current?.status);
  const isCalm = activeCount <= 1;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#F5BE6B" />}
      >
        <View style={styles.orbTop} />
        <View style={styles.orbSide} />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DELISHAFRICA® · MASTER CONTROL · SERVICE ORACLE</Text>
          <Text style={styles.heroTitle}>La prochaine décision, avant le bruit.</Text>
          <Text style={styles.heroBody}>Commandes, cuisine, remise et qualité convergent dans une lecture instantanée.</Text>

          <View style={styles.nextAction}>
            <Text style={styles.nextLabel}>PROCHAINE ACTION</Text>
            <Text style={styles.nextTitle}>Lire la commande</Text>
            <Text style={styles.nextBody}>Valider le plat, le montant et le rythme cuisine.</Text>
          </View>
        </View>

        <View style={styles.orderCard}>
          <View style={styles.orderTopRow}>
            <Text style={styles.orderLabel}>COMMANDE À PILOTER</Text>
            <Text style={styles.orderCode}>{orderCode(current)}</Text>
          </View>
          <Text style={styles.orderTitle}>{orderTitle(current)}</Text>
          <Text style={styles.orderMeta}>{status} · {orderAmount(current)} · {orderItem(current)}</Text>

          <View style={styles.compactSignal}>
            <Text style={styles.compactLabel}>ETA</Text>
            <Text style={styles.compactValue}>31 min</Text>
            <Text style={styles.compactBody}>Préparation + remise coursier</Text>
          </View>
          <View style={styles.compactSignal}>
            <Text style={styles.compactLabel}>Confiance</Text>
            <Text style={styles.compactValue}>92%</Text>
            <Text style={styles.compactBody}>Fenêtre très stable</Text>
          </View>
          <View style={styles.compactSignalLast}>
            <Text style={styles.compactLabel}>Pression cuisine</Text>
            <Text style={styles.compactValue}>{isCalm ? 'Calme' : 'Active'}</Text>
            <Text style={styles.compactBody}>{isCalm ? 'Cuisine sous contrôle' : 'Priorité à garder visible'}</Text>
          </View>
        </View>

        <View style={styles.singleCard}>
          <Text style={styles.singleLabel}>Action</Text>
          <Text style={styles.singleTitle}>Lire</Text>
          <Text style={styles.singleBody}>Commande à valider</Text>
        </View>
        <View style={styles.singleCard}>
          <Text style={styles.singleLabel}>Pression</Text>
          <Text style={styles.singleTitle}>{isCalm ? 'Calme' : 'Active'}</Text>
          <Text style={styles.singleBody}>Cuisine sous contrôle</Text>
        </View>
        <View style={styles.singleCard}>
          <Text style={styles.singleLabel}>Risque</Text>
          <Text style={styles.singleTitle}>Faible</Text>
          <Text style={styles.singleBody}>Promesse client stable</Text>
        </View>
        <View style={styles.singleCard}>
          <Text style={styles.singleLabel}>Signal</Text>
          <Text style={styles.singleTitle}>Live</Text>
          <Text style={styles.singleBody}>Équipe alignée</Text>
        </View>

        <View style={styles.promiseCard}>
          <Text style={styles.promiseLabel}>PROMESSE CUISINE</Text>
          <Text style={styles.promiseTitle}>Préparer juste. Sortir chaud. Servir sans panique.</Text>
          <Text style={styles.promiseBody}>Le restaurant garde le rythme, l’équipe reste alignée et le client comprend chaque étape.</Text>
        </View>

        <View style={styles.motionCard}>
          <Text style={styles.motionLabel}>SERVICE MOTION</Text>
          <Text style={styles.motionTitle}>Recevoir. Préparer. Signaler. Servir.</Text>
          <View style={styles.stepRowActive}>
            <Text style={styles.stepNumberActive}>1</Text>
            <View style={styles.stepTextBlock}>
              <Text style={styles.stepTitleActive}>Recevoir</Text>
              <Text style={styles.stepBodyActive}>La commande arrive dans une file claire.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>2</Text>
            <View style={styles.stepTextBlock}>
              <Text style={styles.stepTitle}>Préparer</Text>
              <Text style={styles.stepBody}>La cuisine sait quoi faire maintenant.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNumber}>3</Text>
            <View style={styles.stepTextBlock}>
              <Text style={styles.stepTitle}>Signaler prêt</Text>
              <Text style={styles.stepBody}>Le départ terrain devient lisible.</Text>
            </View>
          </View>
          <View style={styles.stepRowLast}>
            <Text style={styles.stepNumber}>4</Text>
            <View style={styles.stepTextBlock}>
              <Text style={styles.stepTitle}>Servir</Text>
              <Text style={styles.stepBody}>Le client suit sans bruit technique.</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.navCard} onPress={() => router.push('/orders' as any)}>
          <Text style={styles.navTitle}>Voir les commandes</Text>
          <Text style={styles.navBody}>Piloter la file cuisine sans changer le flux existant.</Text>
        </Pressable>
        <Pressable style={styles.navCard} onPress={() => router.push('/ops-dashboard' as any)}>
          <Text style={styles.navTitle}>Ops & suivi</Text>
          <Text style={styles.navBody}>Lire la qualité de service et garder le restaurant prêt.</Text>
        </Pressable>
        <Pressable style={styles.navCard} onPress={() => router.push('/partner-space' as any)}>
          <Text style={styles.navTitle}>Espace partenaire</Text>
          <Text style={styles.navBody}>Retrouver le profil restaurant et la session progressive.</Text>
        </Pressable>

        <Pressable style={styles.refreshButton} onPress={load}>
          <Text style={styles.refreshText}>Rafraîchir l'oracle</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={() => router.push('/delishafrica-signature' as any)}>
          <Text style={styles.backText}>Retour Signature</Text>
        </Pressable>

        <Text style={styles.footer}>Service Oracle · décision assistée · service sous contrôle.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020B08' },
  scroll: { flex: 1, backgroundColor: '#020B08' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 46 },
  orbTop: { position: 'absolute', right: -68, top: -62, width: 196, height: 196, borderRadius: 98, backgroundColor: 'rgba(245,190,107,0.18)' },
  orbSide: { position: 'absolute', left: -112, top: 410, width: 216, height: 216, borderRadius: 108, backgroundColor: 'rgba(18,96,76,0.28)' },

  hero: { borderWidth: 1, borderColor: 'rgba(245,190,107,0.36)', backgroundColor: 'rgba(3,28,20,0.94)', borderRadius: 32, padding: 28, marginBottom: 24, overflow: 'hidden' },
  eyebrow: { color: '#F5BE6B', fontSize: 12, fontWeight: '900', letterSpacing: 6, lineHeight: 23, marginBottom: 34 },
  heroTitle: { color: '#FFF9EA', fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -2.4 },
  heroBody: { color: 'rgba(255,249,234,0.70)', fontSize: 21, lineHeight: 31, fontWeight: '800', marginTop: 30 },
  nextAction: { marginTop: 34, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(245,190,107,0.30)', backgroundColor: 'rgba(255,249,234,0.04)', padding: 22 },
  nextLabel: { color: '#F5BE6B', fontSize: 12, fontWeight: '900', letterSpacing: 6, lineHeight: 20, marginBottom: 16 },
  nextTitle: { color: '#FFF9EA', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  nextBody: { color: 'rgba(255,249,234,0.72)', fontSize: 18, lineHeight: 26, fontWeight: '800', marginTop: 14 },

  orderCard: { backgroundColor: '#FFF6E8', borderRadius: 30, padding: 28, marginBottom: 20 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 },
  orderLabel: { flex: 1, color: '#9E543A', fontSize: 12, lineHeight: 22, fontWeight: '900', letterSpacing: 6 },
  orderCode: { color: 'rgba(42,12,3,0.52)', fontSize: 13, lineHeight: 22, fontWeight: '900', letterSpacing: 3 },
  orderTitle: { color: '#2A0C03', fontSize: 39, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, marginTop: 30 },
  orderMeta: { color: 'rgba(42,12,3,0.52)', fontSize: 20, lineHeight: 28, fontWeight: '900', marginTop: 18 },
  compactSignal: { borderRadius: 22, padding: 20, marginTop: 22, backgroundColor: 'rgba(42,12,3,0.08)' },
  compactSignalLast: { borderRadius: 22, padding: 20, marginTop: 22, backgroundColor: 'rgba(42,12,3,0.08)' },
  compactLabel: { color: 'rgba(42,12,3,0.48)', fontSize: 12, fontWeight: '900', letterSpacing: 5, lineHeight: 18, marginBottom: 12 },
  compactValue: { color: '#050503', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 },
  compactBody: { color: 'rgba(42,12,3,0.52)', fontSize: 18, lineHeight: 25, fontWeight: '900', marginTop: 12 },

  singleCard: { borderWidth: 1, borderColor: 'rgba(255,249,234,0.14)', backgroundColor: 'rgba(255,249,234,0.055)', borderRadius: 28, padding: 24, marginBottom: 16 },
  singleLabel: { color: '#F5BE6B', fontSize: 13, lineHeight: 20, fontWeight: '900', letterSpacing: 5, marginBottom: 14 },
  singleTitle: { color: '#FFF9EA', fontSize: 33, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  singleBody: { color: 'rgba(255,249,234,0.68)', fontSize: 18, lineHeight: 26, fontWeight: '800', marginTop: 10 },

  promiseCard: { backgroundColor: '#FFF6E8', borderRadius: 30, padding: 30, marginTop: 4, marginBottom: 22 },
  promiseLabel: { color: 'rgba(42,12,3,0.48)', fontSize: 12, lineHeight: 20, fontWeight: '900', letterSpacing: 6, marginBottom: 24 },
  promiseTitle: { color: '#2A0C03', fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4 },
  promiseBody: { color: 'rgba(42,12,3,0.55)', fontSize: 22, lineHeight: 34, fontWeight: '900', marginTop: 26 },

  motionCard: { backgroundColor: '#F5BE6B', borderRadius: 30, padding: 30, marginBottom: 22 },
  motionLabel: { color: '#050503', fontSize: 12, lineHeight: 20, fontWeight: '900', letterSpacing: 7, marginBottom: 24 },
  motionTitle: { color: '#050503', fontSize: 39, lineHeight: 43, fontWeight: '900', letterSpacing: -1.8, marginBottom: 28 },
  stepRowActive: { flexDirection: 'row', gap: 22, alignItems: 'center', marginBottom: 26 },
  stepRow: { flexDirection: 'row', gap: 22, alignItems: 'center', marginBottom: 26, opacity: 0.62 },
  stepRowLast: { flexDirection: 'row', gap: 22, alignItems: 'center', opacity: 0.62 },
  stepNumberActive: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#050503', color: '#F5BE6B', fontSize: 24, lineHeight: 72, fontWeight: '900' },
  stepNumber: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: 'rgba(5,5,3,0.18)', color: '#4B310F', fontSize: 24, lineHeight: 72, fontWeight: '900' },
  stepTextBlock: { flex: 1, minWidth: 0 },
  stepTitleActive: { color: '#050503', fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 },
  stepTitle: { color: '#4B310F', fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8 },
  stepBodyActive: { color: 'rgba(5,5,3,0.62)', fontSize: 17, lineHeight: 25, fontWeight: '900', marginTop: 8 },
  stepBody: { color: '#4B310F', fontSize: 17, lineHeight: 25, fontWeight: '900', marginTop: 8 },

  navCard: { borderWidth: 1, borderColor: 'rgba(255,249,234,0.13)', backgroundColor: 'rgba(255,249,234,0.055)', borderRadius: 28, padding: 24, marginBottom: 16 },
  navTitle: { color: '#FFF9EA', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  navBody: { color: 'rgba(255,249,234,0.66)', fontSize: 18, lineHeight: 27, fontWeight: '800', marginTop: 12 },
  refreshButton: { marginTop: 10, backgroundColor: '#FFF6E8', borderRadius: 999, paddingVertical: 20, alignItems: 'center' },
  refreshText: { color: '#031C14', fontSize: 20, fontWeight: '900' },
  backButton: { marginTop: 16, borderWidth: 1, borderColor: 'rgba(245,190,107,0.42)', borderRadius: 999, paddingVertical: 18, alignItems: 'center' },
  backText: { color: '#F5BE6B', fontSize: 19, fontWeight: '900' },
  footer: { color: 'rgba(255,249,234,0.34)', fontSize: 15, lineHeight: 22, textAlign: 'center', fontWeight: '800', marginTop: 22 },
});
