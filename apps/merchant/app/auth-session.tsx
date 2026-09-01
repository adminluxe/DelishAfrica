import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  daAuthHealth,
  daMe,
  type DaAuthSession,
} from '../utils/daAuthBridge';
import {
  daMerchantOidcLogin,
  daMerchantOidcLogout,
  daMerchantOidcRefresh,
  daMerchantOidcRuntimeStatus,
  daMerchantOidcSession,
  type MerchantOidcSession,
} from '../utils/daMerchantOidc';

export default function AuthSessionScreen() {
  const runtime = useMemo(() => daMerchantOidcRuntimeStatus(), []);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [session, setSession] = useState<DaAuthSession | null>(null);
  const [oidc, setOidc] = useState<MerchantOidcSession | null>(null);

  const refreshAll = useCallback(async () => {
    const [nextHealth, nextOidc, nextSession] = await Promise.all([
      daAuthHealth().catch(() => null),
      daMerchantOidcSession(),
      daMe().catch(() => null),
    ]);
    setHealth(nextHealth);
    setOidc(nextOidc);
    setSession(nextSession);
  }, []);

  async function run(fn: () => Promise<any>) {
    setLoading(true);
    try {
      await fn();
      await refreshAll();
    } catch (error: any) {
      Alert.alert('Connexion Merchant', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const authenticated = Boolean(oidc?.authenticated && session?.authenticated !== false);
  const user = oidc?.user || session?.user || null;
  const apiReady = Boolean(health?.trustedIdentity?.ready ?? health?.ready ?? true);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
          <Text style={styles.title}>Connexion Merchant</Text>
          <Text style={styles.subtitle}>
            Une identité réelle pour les commandes, le service et Master Control. La session reste chiffrée sur cet appareil et se restaure automatiquement.
          </Text>
        </View>

        <View style={[styles.statusRail, authenticated && styles.statusRailLive]}>
          <View style={[styles.dot, authenticated && styles.dotLive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusKicker}>{authenticated ? 'COMPTE MERCHANT ACTIF' : 'ACCÈS MERCHANT'}</Text>
            <Text style={styles.statusText}>
              {authenticated ? 'Session réelle restaurée · cockpit opérationnel' : 'Connexion requise · aucune session simulée'}
            </Text>
          </View>
          <Text style={styles.statusMeta}>{authenticated ? 'PRÊT' : 'À CONNECTER'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>{authenticated ? 'IDENTITÉ CONFIRMÉE' : 'UN COMPTE · TOUT LE COCKPIT'}</Text>
          <Text style={styles.cardTitle}>
            {authenticated ? (user?.name || 'Compte Merchant') : 'Connectez votre identité Merchant réelle.'}
          </Text>
          <Text style={styles.cardBody}>
            {authenticated
              ? 'Commandes, cuisine, remise et supervision peuvent maintenant utiliser la même identité sécurisée.'
              : 'La connexion s’ouvre dans le navigateur système puis revient dans DelishAfrica®. Le mot de passe n’est jamais stocké par l’app.'}
          </Text>

          {authenticated ? (
            <View style={styles.identityGrid}>
              <View style={styles.identityCell}><Text style={styles.identityLabel}>RÔLE</Text><Text style={styles.identityValue}>Merchant</Text></View>
              <View style={styles.identityCell}><Text style={styles.identityLabel}>API</Text><Text style={styles.identityValue}>{apiReady ? 'Prête' : 'À vérifier'}</Text></View>
            </View>
          ) : null}

          <Pressable
            disabled={loading || !runtime.ready}
            style={[styles.primary, (!runtime.ready || loading) && styles.disabled]}
            onPress={() => run(() => authenticated ? daMerchantOidcRefresh() : daMerchantOidcLogin())}
          >
            {loading ? <ActivityIndicator color="#241006" /> : (
              <Text style={styles.primaryText}>{authenticated ? 'Renouveler la session' : 'Connecter le compte Merchant'}</Text>
            )}
          </Pressable>
        </View>

        {!runtime.ready ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Connexion sécurisée indisponible</Text>
            <Text style={styles.warningBody}>Le module d’authentification du client installé doit être actualisé avant la connexion réelle.</Text>
          </View>
        ) : null}

        <View style={styles.trustCard}>
          <Text style={styles.trustKicker}>CONFIANCE DELISHAFRICA®</Text>
          <Text style={styles.trustTitle}>Navigateur système · PKCE · API vérifiée</Text>
          <Text style={styles.trustBody}>Les tokens restent dans SecureStore. Aucun token, mot de passe ou secret n’est affiché dans cette interface.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={() => { void refreshAll(); }}>
            <Text style={styles.secondaryText}>Actualiser l’état</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.replace('/ops-dashboard' as any)}>
            <Text style={styles.secondaryText}>Ouvrir Master Control</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.replace('/orders' as any)}>
            <Text style={styles.secondaryText}>Ouvrir le service</Text>
          </Pressable>
          {authenticated ? (
            <Pressable style={styles.logout} onPress={() => run(() => daMerchantOidcLogout())}>
              <Text style={styles.logoutText}>Déconnecter ce compte</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
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
