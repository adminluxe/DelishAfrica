import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { daAuthHealth, daMe, daMerchantAccess, type DaAuthSession, type DaMerchantAccess } from '../utils/daAuthBridge';
import { daMerchantOidcLogin, daMerchantOidcLogout, daMerchantOidcRefresh, daMerchantOidcRuntimeStatus, daMerchantOidcSession, type MerchantOidcSession } from '../utils/daMerchantOidc';
import { merchantConnectionView } from '../../../packages/contracts/src/merchantIdentity';

export default function AuthSessionScreen() {
  const runtime = useMemo(() => daMerchantOidcRuntimeStatus(), []);
  const [loading, setLoading] = useState(false), [health, setHealth] = useState<any>(null);
  const [session, setSession] = useState<DaAuthSession | null>(null);
  const [oidc, setOidc] = useState<MerchantOidcSession | null>(null);
  const [access, setAccess] = useState<DaMerchantAccess | null>(null);
  const attempt = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; attempt.current++; }; }, []);
  const refreshAll = useCallback(async () => {
    const current = ++attempt.current;
    const [nextHealth, nextOidc, nextSession] = await Promise.all([
      daAuthHealth().catch(() => null), daMerchantOidcSession().catch(() => null),
      daMe().catch((error: any) => ({ ok: false, authenticated: false, apiVerified: false, status: Number(error?.status || 0), reason: String(error?.code || 'merchant_service_unavailable') } as DaAuthSession)),
    ]);
    const nextAccess = nextSession.apiVerified ? await daMerchantAccess().catch(() => null) : null;
    if (!mounted.current || current !== attempt.current) return;
    setHealth(nextHealth); setOidc(nextOidc); setSession(nextSession); setAccess(nextAccess);
  }, []);
  useFocusEffect(useCallback(() => { void refreshAll(); return () => { attempt.current++; }; }, [refreshAll]));
  const view = merchantConnectionView({ oidc, session, health, access });
  const user = view.identityVerified ? session?.user : oidc?.user;
  async function run(fn: () => Promise<any>) {
    setLoading(true);
    try { await fn(); await refreshAll(); }
    catch { Alert.alert('Connexion Merchant', 'L’accès n’a pas pu être confirmé. Réessayez ou vérifiez le rattachement de votre établissement.'); await refreshAll(); }
    finally { if (mounted.current) setLoading(false); }
  }
  const connect = () => run(() => view.action === 'connect' ? daMerchantOidcLogin() : view.action === 'refresh' ? daMerchantOidcRefresh() : Promise.resolve());
  return (
    <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}><Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text><Text style={styles.title}>Connexion Merchant</Text>
        <Text style={styles.subtitle}>Votre compte, votre établissement et vos accès sont vérifiés séparément.</Text></View>
      <View style={[styles.statusRail, view.operational && styles.statusRailLive]}>
        <View style={[styles.dot, view.operational && styles.dotLive]} /><View style={{ flex: 1 }}>
          <Text style={styles.statusKicker}>{view.title}</Text><Text style={styles.statusText}>{view.detail}</Text>
        </View><Text style={styles.statusMeta}>{view.badge}</Text></View>
      <View style={styles.card}><Text style={styles.cardKicker}>{view.identityVerified ? 'IDENTITÉ CONFIRMÉE PAR LE SERVICE' : 'VOTRE COMPTE PARTENAIRE'}</Text>
        <Text style={styles.cardTitle}>{user?.name || 'Connectez votre compte Merchant.'}</Text>
        <Text style={styles.cardBody}>{access?.partnerName ? access.partnerName : 'L’établissement sera affiché après confirmation de son rattachement par le service.'}</Text>
        <View style={[styles.identityGrid, { flexWrap: 'wrap' }]}>
          <View style={styles.identityCell}><Text style={styles.identityLabel}>COMPTE</Text><Text style={styles.identityValue}>{view.oidcConnected ? 'Connecté' : 'À connecter'}</Text></View>
          <View style={styles.identityCell}><Text style={styles.identityLabel}>SERVICE</Text><Text style={styles.identityValue}>{view.apiAvailable ? 'Joignable' : 'À vérifier'}</Text></View>
          <View style={styles.identityCell}><Text style={styles.identityLabel}>IDENTITÉ</Text><Text style={styles.identityValue}>{view.identityVerified ? 'Confirmée' : 'À vérifier'}</Text></View>
          <View style={styles.identityCell}><Text style={styles.identityLabel}>ÉTABLISSEMENT</Text><Text style={styles.identityValue}>{view.operational ? 'Accès validé' : 'À confirmer'}</Text></View>
        </View>
        <Pressable disabled={loading || !runtime.ready} style={[styles.primary, (!runtime.ready || loading) && styles.disabled]} onPress={connect}>
          {loading ? <ActivityIndicator color="#241006" /> : <Text style={styles.primaryText}>{view.action === 'connect' ? 'Connecter le compte Merchant' : view.action === 'refresh' ? 'Renouveler la session' : 'Vérifier mon accès'}</Text>}
        </Pressable>
      </View>
      {!runtime.ready ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Connexion sécurisée indisponible</Text><Text style={styles.warningBody}>Le module de connexion de l’application installée doit être actualisé.</Text></View> : null}
      <View style={styles.trustCard}><Text style={styles.trustKicker}>VOTRE ESPACE PARTENAIRE</Text><Text style={styles.trustTitle}>Un compte connecté ne suffit pas à ouvrir le service.</Text>
        <Text style={styles.trustBody}>Le rattachement à l’établissement et la validation de l’adhésion sont confirmés par le service. Un brouillon local ne donne aucun droit sur un autre établissement.</Text></View>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => void refreshAll()}><Text style={styles.secondaryText}>Actualiser l’état</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace('/ops-dashboard' as any)}><Text style={styles.secondaryText}>Ouvrir Master Control</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace('/orders' as any)}><Text style={styles.secondaryText}>Ouvrir le service</Text></Pressable>
        {view.oidcConnected ? <Pressable style={styles.logout} onPress={() => run(() => daMerchantOidcLogout())}><Text style={styles.logoutText}>Déconnecter ce compte</Text></Pressable> : null}
      </View>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0603' },
  page: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 54 },
  header: { marginBottom: 24 },
  brand: { color: '#F4B56B', fontSize: 12, fontWeight: '900', letterSpacing: 3.4 },
  title: { color: '#FFF8F1', fontSize: 40, lineHeight: 46, fontWeight: '900', marginTop: 12 },
  subtitle: { color: 'rgba(255,248,241,0.62)', fontSize: 17, lineHeight: 26, fontWeight: '600', marginTop: 12 },
  statusRail: { minHeight: 82, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(244,181,107,0.28)', backgroundColor: 'rgba(45,18,7,0.76)', paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  statusRailLive: { borderColor: 'rgba(143,226,192,0.32)', backgroundColor: 'rgba(7,37,26,0.72)' },
  dot: { width: 11, height: 11, borderRadius: 99, backgroundColor: '#F4B56B' },
  dotLive: { backgroundColor: '#8FE2C0' },
  statusKicker: { color: '#F4B56B', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  statusText: { color: 'rgba(255,248,241,0.72)', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  statusMeta: { color: '#FFD8AD', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  card: { borderRadius: 30, padding: 22, backgroundColor: '#FFF0E2', marginBottom: 16 },
  cardKicker: { color: '#A85B2F', fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  cardTitle: { color: '#2A1006', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 12 },
  cardBody: { color: '#7B6559', fontSize: 16, lineHeight: 24, fontWeight: '600', marginTop: 10 },
  identityGrid: { flexDirection: 'row', gap: 10, marginTop: 18 },
  identityCell: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: 'rgba(42,16,6,0.06)' },
  identityLabel: { color: '#A85B2F', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  identityValue: { color: '#2A1006', fontSize: 18, fontWeight: '900', marginTop: 6 },
  primary: { minHeight: 56, borderRadius: 18, marginTop: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4B56B' },
  primaryText: { color: '#241006', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  warningCard: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(244,181,107,0.30)', backgroundColor: 'rgba(78,35,13,0.44)', marginBottom: 16 },
  warningTitle: { color: '#FFD8AD', fontSize: 16, fontWeight: '900' },
  warningBody: { color: 'rgba(255,216,173,0.70)', lineHeight: 21, marginTop: 7 },
  trustCard: { borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.035)', marginBottom: 16 },
  trustKicker: { color: '#F4B56B', fontSize: 9, fontWeight: '900', letterSpacing: 2.2 },
  trustTitle: { color: '#FFF8F1', fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 9 },
  trustBody: { color: 'rgba(255,248,241,0.56)', fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { gap: 10 },
  secondary: { borderRadius: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(244,181,107,0.22)', backgroundColor: 'rgba(244,181,107,0.07)' },
  secondaryText: { color: '#FFD8AD', fontSize: 14, fontWeight: '800' },
  logout: { borderRadius: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,120,120,0.24)', backgroundColor: 'rgba(127,29,29,0.14)' },
  logoutText: { color: '#F6B0A8', fontSize: 14, fontWeight: '800' },
});
