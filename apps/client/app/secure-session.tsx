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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';

const SAFE_NEXT = new Set([
  '/checkout-preflight',
  '/live-tracking',
  '/orders',
  '/client-space',
]);

function requestedNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = String(raw || '').trim();
  return SAFE_NEXT.has(candidate) ? candidate : '/client-space';
}

export default function SecureSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const auth = useDaPkceAuth();
  const nextRoute = requestedNext(params.next);
  const authenticated = auth.session.status === 'authenticated';

  const status = useMemo(() => {
    if (auth.session.status === 'authenticated') return 'Compte connecté';
    if (auth.session.status === 'reauth_required') return 'Connexion à renouveler';
    if (auth.session.status === 'error') return 'Connexion à reprendre';
    return 'Prêt à continuer';
  }, [auth.session.status]);

  const identity = auth.session.displayName || auth.session.email || '';

  async function continueWithDelishAfrica() {
    if (authenticated) {
      router.replace(nextRoute as any);
      return;
    }

    const next = await auth.signIn();
    if (next.status === 'error') {
      Alert.alert(
        'Connexion DelishAfrica',
        'La connexion a été interrompue. Réessayez dans un instant.',
      );
      return;
    }

    if (next.status === 'authenticated') {
      router.replace(nextRoute as any);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Votre compte DelishAfrica</Text>
        <Text style={styles.subtitle}>
          Une connexion suffit pour commander, payer et retrouver vos suivis.
          Lorsqu’elle est encore valide, DelishAfrica la restaure automatiquement
          sur cet appareil.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.kicker}>COMPTE CLIENT</Text>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.detail}>
            {authenticated
              ? identity
                ? `Identité active : ${identity}`
                : 'Votre identité DelishAfrica est active.'
              : 'La découverte reste libre. La connexion n’est demandée que pour vos actions personnelles.'}
          </Text>
          {auth.lastError ? (
            <Text style={styles.error}>
              Un problème a interrompu la dernière tentative. Vous pouvez réessayer.
            </Text>
          ) : null}
        </View>

        <Pressable
          disabled={auth.busy || (!authenticated && !auth.requestReady)}
          onPress={continueWithDelishAfrica}
          style={[
            styles.primary,
            (auth.busy || (!authenticated && !auth.requestReady)) && styles.disabled,
          ]}
        >
          {auth.busy ? (
            <ActivityIndicator color="#07130E" />
          ) : (
            <Text style={styles.primaryText}>
              {authenticated ? 'Continuer' : 'Continuer avec DelishAfrica'}
            </Text>
          )}
        </Pressable>

        {authenticated ? (
          <Pressable disabled={auth.busy} onPress={auth.logout} style={styles.logout}>
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.replace('/client-space' as any)}
          style={styles.back}
        >
          <Text style={styles.backText}>
            {authenticated ? 'Retour à Mon espace' : 'Plus tard'}
          </Text>
        </Pressable>

        <Text style={styles.privacy}>
          Vos identifiants, codes et jetons de session ne sont jamais affichés sur
          cet écran.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#04150E' },
  page: { padding: 22, paddingBottom: 64 },
  brand: {
    color: '#E7B85F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 8,
  },
  title: {
    color: '#FFF8EA',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    marginTop: 14,
  },
  subtitle: {
    color: '#9BA79F',
    fontSize: 17,
    lineHeight: 25,
    marginTop: 10,
    marginBottom: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 26,
    backgroundColor: '#0A2418',
    borderWidth: 1,
    borderColor: 'rgba(231,184,95,0.28)',
  },
  kicker: {
    color: '#E7B85F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  status: {
    color: '#FFF8EA',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 7,
    marginBottom: 12,
  },
  detail: { color: '#A5B1AA', fontSize: 14, lineHeight: 22 },
  error: {
    color: '#FFB4AB',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    lineHeight: 19,
  },
  primary: {
    minHeight: 58,
    marginTop: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7B85F',
  },
  primaryText: { color: '#07130E', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  logout: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: { color: '#D7CBAE', fontSize: 14, fontWeight: '900' },
  back: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#163B2A',
    marginTop: 8,
  },
  backText: { color: '#FFF8EA', fontSize: 14, fontWeight: '900' },
  privacy: {
    color: '#7F9187',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 18,
  },
});
