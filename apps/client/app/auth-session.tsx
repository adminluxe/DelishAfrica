import React, { useMemo } from 'react';
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

const ROLE_LABEL = 'CLIENT';
const ACCENT = '#4BA3FF';

function formatExpiry(value?: number): string {
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString();
}

export default function AuthSessionScreen() {
  const oidc = useDaPkceAuth();

  const statusLabel = useMemo(() => {
    if (oidc.session.status === 'authenticated') return 'Compte DelishAfrica connecté';
    if (oidc.session.status === 'reauth_required') return 'Reconnectez-vous pour continuer';
    if (oidc.session.status === 'error') return 'Connexion à vérifier';
    return 'Connexion DelishAfrica prête';
  }, [oidc.session.status]);

  async function login() {
    const next = await oidc.signIn();
    if (next.status === 'error') {
      Alert.alert('Connexion DelishAfrica', 'Nous ne pouvons pas vous connecter pour le moment. Réessayez.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.kicker, { color: ACCENT }]}>DELISHAFRICA® · {ROLE_LABEL}</Text>
          <Text style={styles.title}>Connexion sécurisée</Text>
          <Text style={styles.subtitle}>
            Connectez-vous en toute confiance pour retrouver vos commandes et votre espace DelishAfrica.
          </Text>
          <View style={[styles.pill, { borderColor: ACCENT }]}>
            <Text style={[styles.pillText, { color: ACCENT }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session Client</Text>
          <Text style={styles.row}>Connexion : {oidc.discoveryReady ? 'prête' : 'chargement'}</Text>
          <Text style={styles.row}>Protection : {oidc.requestReady ? 'prête' : 'préparation'}</Text>
          <Text style={styles.row}>Accès : Client</Text>
          <Text style={styles.row}>
            Identité : {oidc.session.displayName || oidc.session.email || 'non connectée'}
          </Text>
          <Text style={styles.row}>Connexion valable jusqu’au : {formatExpiry(oidc.session.expiresAt)}</Text>
          {oidc.lastError ? <Text style={styles.error}>La connexion n’a pas abouti. Réessayez dans un instant.</Text> : null}
        </View>

        <Pressable
          disabled={oidc.busy || !oidc.requestReady}
          style={[
            styles.primary,
            { backgroundColor: ACCENT },
            (oidc.busy || !oidc.requestReady) && styles.disabled,
          ]}
          onPress={login}
        >
          {oidc.busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Continuer avec DelishAfrica</Text>
          )}
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable disabled={oidc.busy} style={styles.secondary} onPress={oidc.restore}>
            <Text style={styles.secondaryText}>Vérifier ma connexion</Text>
          </Pressable>
          <Pressable disabled={oidc.busy} style={styles.secondary} onPress={oidc.refresh}>
            <Text style={styles.secondaryText}>Actualiser</Text>
          </Pressable>
        </View>

        <Pressable disabled={oidc.busy} style={styles.logout} onPress={oidc.logout}>
          <Text style={styles.logoutText}>Me déconnecter</Text>
        </Pressable>

        <View style={styles.trustCard}>
          <Text style={styles.trustKicker}>CONFIANCE DELISHAFRICA®</Text>
          <Text style={styles.trustTitle}>Votre sécurité, notre priorité</Text>
          <Text style={styles.trustBody}>
            Nous protégeons vos informations personnelles sans les exposer sur cet écran.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F' },
  content: { padding: 20, paddingBottom: 44, gap: 14 },
  hero: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 10, color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  subtitle: { marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: { fontSize: 12, fontWeight: '900' },
  card: { borderRadius: 24, padding: 18, backgroundColor: '#FFFFFF' },
  cardTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  row: { color: '#475569', fontSize: 14, lineHeight: 22 },
  error: { marginTop: 10, color: '#B91C1C', fontSize: 13, fontWeight: '800' },
  primary: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  secondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  logout: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: 'rgba(255,255,255,0.76)', fontSize: 14, fontWeight: '900' },
  trustCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#0B2032',
    borderWidth: 1,
    borderColor: 'rgba(75,163,255,0.28)',
  },
  trustKicker: { color: ACCENT, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  trustTitle: { marginTop: 10, color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  trustBody: { marginTop: 8, color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 20 },
});
