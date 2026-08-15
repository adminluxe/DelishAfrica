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
import { useRouter } from 'expo-router';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';

function formatExpiry(value?: number): string {
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString();
}

export default function SecureSessionScreen() {
  const router = useRouter();
  const auth = useDaPkceAuth();

  const status = useMemo(() => {
    if (auth.session.status === 'authenticated') return 'Session Keycloak active';
    if (auth.session.status === 'reauth_required') return 'Réauthentification requise';
    if (auth.session.status === 'error') return 'Session à vérifier';
    return 'Connexion sécurisée prête';
  }, [auth.session.status]);

  async function signIn() {
    const next = await auth.signIn();
    if (next.status === 'error') {
      Alert.alert('Connexion sécurisée', next.reason || 'Connexion interrompue.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Connexion sécurisée</Text>
        <Text style={styles.subtitle}>
          Votre compte Keycloak protège la session. Les preuves SMS, e-mail et adresse restent un contrôle distinct.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.kicker}>SESSION CLIENT</Text>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.detail}>Rôle : {auth.session.role}</Text>
          <Text style={styles.detail}>Identité : {auth.session.displayName || auth.session.email || 'non connectée'}</Text>
          <Text style={styles.detail}>Expiration : {formatExpiry(auth.session.expiresAt)}</Text>
          {auth.lastError ? <Text style={styles.error}>Code sûr : {auth.lastError}</Text> : null}
        </View>

        <Pressable
          disabled={auth.busy || !auth.requestReady}
          onPress={signIn}
          style={[styles.primary, (auth.busy || !auth.requestReady) && styles.disabled]}
        >
          {auth.busy ? <ActivityIndicator color="#07130E" /> : <Text style={styles.primaryText}>Se connecter avec Keycloak</Text>}
        </Pressable>

        <View style={styles.actions}>
          <Pressable disabled={auth.busy} onPress={auth.restore} style={styles.secondary}>
            <Text style={styles.secondaryText}>Relire la session</Text>
          </Pressable>
          <Pressable disabled={auth.busy} onPress={auth.refresh} style={styles.secondary}>
            <Text style={styles.secondaryText}>Rafraîchir</Text>
          </Pressable>
        </View>

        <Pressable disabled={auth.busy} onPress={auth.logout} style={styles.logout}>
          <Text style={styles.logoutText}>Déconnexion sécurisée</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/client-space' as any)} style={styles.back}>
          <Text style={styles.backText}>Retour à Mon espace</Text>
        </Pressable>

        <Text style={styles.privacy}>
          Aucun token, code, verifier ou nonce n’est affiché sur cet écran.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#04150E' },
  page: { padding: 22, paddingBottom: 64 },
  brand: { color: '#E7B85F', fontSize: 18, fontWeight: '900', letterSpacing: 6, marginTop: 8 },
  title: { color: '#FFF8EA', fontSize: 42, lineHeight: 48, fontWeight: '900', marginTop: 14 },
  subtitle: { color: '#9BA79F', fontSize: 17, lineHeight: 25, marginTop: 10, marginBottom: 20 },
  statusCard: { padding: 20, borderRadius: 26, backgroundColor: '#0A2418', borderWidth: 1, borderColor: 'rgba(231,184,95,0.28)' },
  kicker: { color: '#E7B85F', fontSize: 11, fontWeight: '900', letterSpacing: 2.5 },
  status: { color: '#FFF8EA', fontSize: 24, fontWeight: '900', marginTop: 7, marginBottom: 12 },
  detail: { color: '#A5B1AA', fontSize: 14, lineHeight: 22 },
  error: { color: '#FFB4AB', fontSize: 13, fontWeight: '800', marginTop: 10 },
  primary: { minHeight: 56, marginTop: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7B85F' },
  primaryText: { color: '#07130E', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondary: { flex: 1, minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102D20', borderWidth: 1, borderColor: 'rgba(231,184,95,0.18)' },
  secondaryText: { color: '#FFF8EA', fontSize: 13, fontWeight: '900' },
  logout: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  logoutText: { color: '#D7CBAE', fontSize: 14, fontWeight: '900' },
  back: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#163B2A', marginTop: 6 },
  backText: { color: '#FFF8EA', fontSize: 14, fontWeight: '900' },
  privacy: { color: '#7F9187', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
