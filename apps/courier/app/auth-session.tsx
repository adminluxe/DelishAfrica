import React, { useEffect, useMemo, useState } from 'react';
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
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';
import {
  daAuthAccent,
  daAuthApiBase,
  daAuthHealth,
  daAuthLabel,
  daAuthRole,
  daDevLogin,
  daLogout as daProgressiveLogout,
  daMe,
  daVerify,
  type DaAuthSession,
} from '../utils/daAuthBridge';

const APP_LABEL = 'le cockpit Courier';
const ROLE_LABEL = 'COURIER';

function formatExpiry(value?: number): string {
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString();
}

export default function AuthSessionScreen() {
  const accent = daAuthAccent();
  const oidc = useDaPkceAuth();
  const [progressive, setProgressive] = useState<DaAuthSession | null>(null);
  const [progressiveBusy, setProgressiveBusy] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [progressiveTrace, setProgressiveTrace] = useState<string[]>([]);

  function pushProgressive(label: string) {
    setProgressiveTrace((previous) => [
      `${new Date().toLocaleTimeString()} · ${label}`,
      ...previous,
    ].slice(0, 8));
  }

  async function runProgressive(label: string, task: () => Promise<DaAuthSession>) {
    setProgressiveBusy(true);
    try {
      pushProgressive(label);
      const next = await task();
      setProgressive(next);
      pushProgressive(`OK ${label}`);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushProgressive(`ERR ${label} · ${message}`);
      Alert.alert('Session progressive', message);
      return null;
    } finally {
      setProgressiveBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void daAuthHealth()
      .then((next) => { if (mounted) setHealth(next); })
      .catch(() => { if (mounted) setHealth(null); });
    void daMe()
      .then((next) => { if (mounted) setProgressive(next); })
      .catch(() => { if (mounted) setProgressive(null); });
    return () => { mounted = false; };
  }, []);

  const statusLabel = useMemo(() => {
    if (oidc.session.status === 'authenticated') return 'Session Keycloak active';
    if (oidc.session.status === 'reauth_required') return 'Réauthentification requise';
    if (oidc.session.status === 'error') return 'Session à vérifier';
    return 'Connexion sécurisée prête';
  }, [oidc.session.status]);

  async function login() {
    const next = await oidc.signIn();
    if (next.status === 'error') {
      Alert.alert('Connexion sécurisée', next.reason || 'Connexion interrompue.');
    }
  }

  const progressiveUser = progressive?.user || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.kicker, { color: accent }]}>DELISHAFRICA® · {ROLE_LABEL}</Text>
          <Text style={styles.title}>Connexion sécurisée</Text>
          <Text style={styles.subtitle}>
            Authorization Code + PKCE S256 pour {APP_LABEL}, sans secret embarqué.
          </Text>
          <View style={[styles.pill, { borderColor: accent }]}>
            <Text style={[styles.pillText, { color: accent }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>État OIDC</Text>
          <Text style={styles.row}>Discovery : {oidc.discoveryReady ? 'prête' : 'chargement'}</Text>
          <Text style={styles.row}>Requête PKCE : {oidc.requestReady ? 'prête' : 'préparation'}</Text>
          <Text style={styles.row}>Rôle attendu : {oidc.session.role}</Text>
          <Text style={styles.row}>Identité : {oidc.session.displayName || oidc.session.email || 'non connectée'}</Text>
          <Text style={styles.row}>Expiration : {formatExpiry(oidc.session.expiresAt)}</Text>
          <Text style={styles.row}>Redirect natif : {oidc.redirectUri}</Text>
          {oidc.lastError ? <Text style={styles.error}>Code sûr : {oidc.lastError}</Text> : null}
        </View>

        <Pressable
          disabled={oidc.busy || !oidc.requestReady}
          style={[styles.primary, { backgroundColor: accent }, (oidc.busy || !oidc.requestReady) && styles.disabled]}
          onPress={login}
        >
          {oidc.busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Se connecter avec Keycloak</Text>
          )}
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable disabled={oidc.busy} style={styles.secondary} onPress={oidc.restore}>
            <Text style={styles.secondaryText}>Relire</Text>
          </Pressable>
          <Pressable disabled={oidc.busy} style={styles.secondary} onPress={oidc.refresh}>
            <Text style={styles.secondaryText}>Rafraîchir</Text>
          </Pressable>
        </View>

        <Pressable disabled={oidc.busy} style={styles.logout} onPress={oidc.logout}>
          <Text style={styles.logoutText}>Déconnexion sécurisée</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journal OIDC sûr</Text>
          {oidc.trace.length ? oidc.trace.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.trace}>• {line}</Text>
          )) : <Text style={styles.row}>Aucun événement.</Text>}
          <Text style={styles.hint}>Aucun token, code, verifier ou nonce n’est affiché.</Text>
        </View>

        <View style={styles.compatCard}>
          <Text style={styles.compatTitle}>Compatibilité Auth progressive V1</Text>
          <Text style={styles.compatText}>
            Le flow business reste volontairement sur son bearer progressif tant que le bridge API Client/Courier est différé.
          </Text>
          <Text style={styles.compatText}>API : {daAuthApiBase()}</Text>
          <Text style={styles.compatText}>Health : {health?.ok ? 'OK' : 'en attente'}</Text>
          <Text style={styles.compatText}>Mode : {health?.mode || 'progressive'}</Text>
          <Text style={styles.compatText}>Espace : {daAuthLabel()}</Text>
          <Text style={styles.compatText}>Rôle : {daAuthRole()}</Text>
          <Text style={styles.compatText}>Authentifié : {progressive?.authenticated ? 'oui' : 'non'}</Text>
          <Text style={styles.compatText}>Utilisateur : {progressiveUser?.name || 'aucun'}</Text>

          <View style={styles.compatActions}>
            <Pressable
              disabled={progressiveBusy}
              style={[styles.compatPrimary, { backgroundColor: accent }]}
              onPress={() => runProgressive('dev-login', () => daDevLogin())}
            >
              <Text style={styles.compatPrimaryText}>Activer session progressive</Text>
            </Pressable>
            <Pressable
              disabled={progressiveBusy}
              style={styles.compatButton}
              onPress={() => runProgressive('/me', () => daMe())}
            >
              <Text style={styles.compatButtonText}>Rafraîchir /me</Text>
            </Pressable>
            <Pressable
              disabled={progressiveBusy}
              style={styles.compatButton}
              onPress={() => runProgressive('/verify', () => daVerify())}
            >
              <Text style={styles.compatButtonText}>Vérifier token V1</Text>
            </Pressable>
            <Pressable
              disabled={progressiveBusy}
              style={styles.compatDanger}
              onPress={() => runProgressive('logout V1', async () => {
                await daProgressiveLogout();
                return await daMe();
              })}
            >
              <Text style={styles.compatDangerText}>Effacer session progressive</Text>
            </Pressable>
          </View>

          {progressiveBusy ? <ActivityIndicator style={{ marginTop: 14 }} /> : null}
          {progressiveTrace.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.compatTrace}>{line}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F' },
  content: { padding: 20, paddingBottom: 44, gap: 14 },
  hero: { borderRadius: 30, padding: 22, backgroundColor: '#0F172A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 10, color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22 },
  pill: { alignSelf: 'flex-start', marginTop: 16, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontSize: 12, fontWeight: '900' },
  card: { borderRadius: 24, padding: 18, backgroundColor: '#FFFFFF' },
  cardTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  row: { color: '#475569', fontSize: 14, lineHeight: 22 },
  error: { marginTop: 10, color: '#B91C1C', fontSize: 13, fontWeight: '800' },
  hint: { marginTop: 10, color: '#64748B', fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  secondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  logout: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: 'rgba(255,255,255,0.76)', fontSize: 14, fontWeight: '900' },
  trace: { color: '#475569', fontSize: 13, lineHeight: 20 },
  compatCard: { borderRadius: 24, padding: 18, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  compatTitle: { color: '#92400E', fontSize: 17, fontWeight: '900' },
  compatText: { marginTop: 7, color: '#78350F', fontSize: 13, lineHeight: 19 },
  compatActions: { marginTop: 12, gap: 9 },
  compatPrimary: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  compatPrimaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  compatButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#92400E' },
  compatButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  compatDanger: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7F1D1D' },
  compatDangerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  compatTrace: { marginTop: 6, color: '#78350F', fontSize: 12, lineHeight: 18 },
});
