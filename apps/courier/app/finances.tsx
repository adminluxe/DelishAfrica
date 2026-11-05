// DA_R6F_FINANCE_READONLY_SAFE - financial evidence; no fabricated payout or balance.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { daOrdersFetch } from '../utils/daOrdersApi';

const ROLE = String('courier') as 'merchant' | 'courier';
const COLORS = ROLE === 'merchant'
  ? { bg: '#140D09', card: '#211610', tint: '#EBAE71', text: '#FFF4E7' }
  : { bg: '#03170F', card: '#10281D', tint: '#9FE4B6', text: '#F0FFF6' };
const RAW = process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.delishafrica.me/api/v1';
const API = RAW.replace(/\/+$/, '').endsWith('/api/v1')
  ? RAW.replace(/\/+$/, '') : RAW.replace(/\/+$/, '') + '/api/v1';

type Evidence = { id?: string; orderId?: string; publicId?: string;
  status?: string; payment?: { status?: string; paid?: boolean } };
type Snapshot = { orders: Evidence[]; observedAt: string };
function listFrom(payload: any): Evidence[] {
  const x = Array.isArray(payload) ? payload :
    Array.isArray(payload?.orders) ? payload.orders :
    Array.isArray(payload?.items) ? payload.items :
    Array.isArray(payload?.data?.orders) ? payload.data.orders :
    Array.isArray(payload?.data) ? payload.data : [];
  return x.filter((v: unknown): v is Evidence => Boolean(v && typeof v === 'object'));
}
function humanStatus(v: string) {
  const map: Record<string,string> = {
    pending: 'Reçue', accepted: 'Acceptée', ready: 'Prête',
    picked_up: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée',
  };
  return map[v] || 'En cours';
}
function Action({ title, onPress, primary=false }: {
  title: string; onPress: () => void; primary?: boolean
}) {
  return <Pressable
    accessible accessibilityRole="button" accessibilityLabel={title}
    onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}
  ><Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{title}</Text></Pressable>;
}
export default function FinanceCockpit() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    setBusy(true);
    setAccessDenied(false);
    setSnapshot(null); // Never keep a previous identity's financial activity.
    try {
      const res = await daOrdersFetch(API + '/orders/demo/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        setAccessDenied(res.status === 401 || res.status === 403);
        setNotice('Les données ne sont pas accessibles pour cette session.');
        return;
      }
      const data = await res.json();
      setSnapshot({ orders: listFrom(data), observedAt: new Date().toISOString() });
      setNotice('Activité issue de votre session sécurisée. Données non comptables.');
    } catch {
      setAccessDenied(true);
      setNotice('Connectez-vous à votre compte professionnel pour consulter votre activité.');
    } finally { setBusy(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const orders = snapshot?.orders ?? [];
  const complete = orders.filter(o => String(o.status || '').toLowerCase() === 'delivered').length;
  const paid = orders.filter(o => o.payment?.paid === true ||
    ['paid','succeeded'].includes(String(o.payment?.status || '').toLowerCase())).length;
  const label = ROLE === 'merchant' ? 'RESTAURATEUR' : 'COURSIER';
  return <ScrollView
    style={[styles.page, { backgroundColor: COLORS.bg }]}
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { void refresh(); }} tintColor={COLORS.tint} />}
  >
    <Text style={[styles.kicker, { color: COLORS.tint }]}>DELISHAFRICA®  ·  {label}</Text>
    <Text style={[styles.title, { color: COLORS.text }]}>Mes finances</Text>
    <Text style={styles.subtitle}>Vos opérations, vos justificatifs et vos futurs versements, dans un seul espace.</Text>

    <View style={[styles.notice, { backgroundColor: COLORS.card }]}>
      <Text style={[styles.noticeTitle, { color: COLORS.tint }]}>TRAÇABILITÉ AVANT SOLDE</Text>
      <Text style={[styles.text, { color: COLORS.text }]}>Les montants définitifs, commissions, frais et versements ne seront affichés qu'après rapprochement avec OrchidPay® et le prestataire de paiement. Aucune somme n'est ici annoncée comme acquise.</Text>
    </View>

    <Text style={[styles.heading, { color: COLORS.text }]}>Relevé d'activité</Text>
    {busy ? <ActivityIndicator color={COLORS.tint} size="large" /> : (
      accessDenied ? <View style={[styles.panel, { backgroundColor: COLORS.card }]}>
        <Text style={[styles.text, { color: COLORS.text }]}>Session {label.toLowerCase()} vérifiée requise.</Text>
        <Action title="Ouvrir la connexion" primary onPress={() => router.push('/auth-session' as any)} />
      </View> : (
        <View style={styles.row}>
          <View style={[styles.metric, { backgroundColor: COLORS.card }]}>
            <Text style={styles.metricTitle}>Commandes / missions</Text>
            <Text style={[styles.metricValue, { color: COLORS.tint }]}>{snapshot ? orders.length : '—'}</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: COLORS.card }]}>
            <Text style={styles.metricTitle}>Livrées</Text>
            <Text style={[styles.metricValue, { color: COLORS.tint }]}>{snapshot ? complete : '—'}</Text>
          </View>
        </View>
      )
    )}
    <Text style={styles.helper}>{snapshot ? 'Dernier contrôle : ' + new Date(snapshot.observedAt).toLocaleString('fr-BE') : 'Aucun relevé confirmé dans cette session.'}</Text>
    {snapshot && ROLE === 'merchant' ? <Text style={styles.helper}>Paiements signalés dans les commandes : {paid}. Information opérationnelle, sans valeur de justificatif financier.</Text> : null}
    <Text style={[styles.heading, { color: COLORS.text }]}>Compte financier</Text>
    {[
      ['Solde payable', 'En attente de rapprochement'],
      [ROLE === 'merchant' ? 'Commissions et frais' : 'Rémunération des courses', 'Barème et contrat à valider'],
      ['Versements effectués', 'Aucun relevé bancaire validé'],
      ['Factures / exports', 'Disponibles après activation réglementaire'],
    ].map(([title,body]) => <View key={title} style={[styles.line, { backgroundColor: COLORS.card }]}>
      <Text style={[styles.lineTitle, { color: COLORS.text }]}>{title}</Text>
      <Text style={styles.lineValue}>{body}</Text>
    </View>)}
    {snapshot && orders.length > 0 ? <>
      <Text style={[styles.heading, { color: COLORS.text }]}>Dernières opérations associées</Text>
      {orders.slice(0,5).map((o,i) => <View key={String(o.orderId || o.id || o.publicId || i) + i} style={styles.activity}>
        <Text style={[styles.text,{color:COLORS.text}]}>{String(o.publicId || o.orderId || o.id || 'Opération')}</Text>
        <Text style={styles.helper}>{humanStatus(String(o.status || ''))}</Text>
      </View>)}
    </> : null}
    <Text style={styles.helper}>{notice || 'Actualisez votre espace pour contrôler les opérations.'}</Text>
    <View style={styles.actions}>
      <Action title="Actualiser" primary onPress={() => { void refresh(); }} />
      <Action title={ROLE === 'merchant' ? 'Retour aux commandes' : 'Voir mes missions'} onPress={() => router.push('/orders' as any)} />
      <Action title="Mon profil" onPress={() => router.push((ROLE === 'merchant' ? '/partner-space' : '/courier-space') as any)} />
    </View>
    <Text style={styles.footer}>La plateforme n'initie aucun transfert de fonds depuis cet écran. Les opérations bancaires requièrent une autorité financière et des validations distinctes.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { paddingTop: 52, paddingHorizontal: 19, paddingBottom: 58, gap: 9 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { fontSize: 34, fontWeight: '800', marginTop: 10 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#BAC9C0', marginBottom: 12 },
  notice: { borderRadius: 18, padding: 18, gap: 10, marginBottom: 12 },
  noticeTitle: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  text: { fontSize: 14, lineHeight: 21 },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 13, marginBottom: 5 },
  row: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, padding: 18, borderRadius: 16, minHeight: 102 },
  metricTitle: { fontSize: 12, color: '#B9C1BC' },
  metricValue: { fontSize: 29, fontWeight: '800', marginTop: 8 },
  helper: { fontSize: 12, color: '#9CAEA5', lineHeight: 18 },
  panel: { padding: 18, borderRadius: 14, gap: 12 },
  line: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, marginBottom: 3 },
  lineTitle: { fontWeight: '700', fontSize: 14 },
  lineValue: { color: '#BAC1BB', fontSize: 12, marginTop: 4 },
  activity: { borderBottomWidth: 1, borderBottomColor: '#58756730', paddingVertical: 9 },
  actions: { gap: 9, marginTop: 11 },
  action: { borderRadius: 14, borderWidth: 1, borderColor: '#9EA99E55', padding: 15, alignItems: 'center' },
  actionPrimary: { backgroundColor: '#E3BD82', borderColor: '#E3BD82' },
  actionText: { color: '#FFF4E7', fontWeight: '700', fontSize: 14 },
  actionTextPrimary: { color: '#16281D' },
  footer: { fontSize: 11, color: '#9FADA4', lineHeight: 17, marginTop: 18 },
});
