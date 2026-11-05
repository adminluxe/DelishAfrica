// DA_GALA_SILENT_CHROME_V1 - global subtraction pass: visual chrome recedes, decision anchors and operational signals stay intact; static styles only.
// DA_GALA_VELVET_CONTRAST_V1 - focal gravity: dark secondary planes recede while human-decision anchors remain luminous; static styles only.
// DA_GALA_SELECTIVE_FOCUS_V1 - selective optical focus: primary actions stay crisp while secondary material dissolves; static styles only.
// DA_GALA_QUIET_LUXURY_V1 - zero-cost optical rhythm polish: softer hierarchy, quieter edges, fewer decorative signals; static styles only.
// DA_GALA_EDGELESS_CONTINUITY_V1 - last-mile surface polish dissolves legacy spectral leaks and reduces card-edge fatigue; presentation only.
// DA_GALA_INTERACTION_OSMOSIS_V1 - shared actions inherit each app chroma while deep surfaces breathe more freely; no new timer, dependency or business mutation.
import React from 'react';
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

const ACCENT = '#75EFA4';

export default function CourierAuthSessionScreen() {
  const router = useRouter();
  const oidc = useDaPkceAuth();
  const authenticated = oidc.session.status === 'authenticated';
  const safeError = oidc.lastError || (oidc.session.status === 'error' ? oidc.session.reason || 'oidc_error' : null);
  const identity = oidc.session.displayName || oidc.session.email || 'Compte Courier';

  async function primaryAction() {
    const next = authenticated ? await oidc.refresh() : await oidc.signIn();
    if (next.status === 'error') {
      Alert.alert('Connexion Courier', `La session sécurisée n’a pas pu être confirmée (${next.reason || oidc.lastError || 'erreur_sure'}). Aucun secret n’est affiché.`);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
        <Text style={styles.title}>Connexion Courier</Text>
        <Text style={styles.subtitle}>
          Une identité réelle pour les missions, le terrain et les outils Courier. La session reste chiffrée sur cet appareil et se restaure automatiquement.
        </Text>

        <View style={[styles.statusCard, authenticated && styles.statusCardReady]}>
          <View style={[styles.dot, authenticated && styles.dotReady]} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusKicker}>{authenticated ? 'COMPTE COURIER ACTIF' : 'ACCÈS COURIER · À CONNECTER'}</Text>
            <Text style={styles.statusText}>
              {authenticated ? 'Session réelle restaurée · terrain opérationnel' : 'Connectez le compte Courier réel pour ouvrir les flux opérationnels.'}
            </Text>
          </View>
          <Text style={styles.statusFlag}>{authenticated ? 'PRÊT' : 'À CONNECTER'}</Text>
        </View>

        <View style={styles.identityCard}>
          <Text style={styles.cardKicker}>{authenticated ? 'IDENTITÉ CONFIRMÉE' : 'IDENTITÉ REQUISE'}</Text>
          <Text style={styles.identityTitle}>{authenticated ? identity : 'Compte Courier'}</Text>
          <Text style={styles.identityBody}>
            {authenticated
              ? 'Missions, présence terrain et navigation peuvent maintenant utiliser la même identité sécurisée.'
              : 'Aucune session simulée ne prend le relais. La connexion passe par le navigateur système et PKCE.'}
          </Text>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricLabel}>RÔLE</Text><Text style={styles.metricValue}>Courier</Text></View>
            <View style={styles.metric}><Text style={styles.metricLabel}>SESSION</Text><Text style={styles.metricValue}>{authenticated ? 'Prête' : 'Requise'}</Text></View>
          </View>
          <Pressable
            disabled={oidc.busy || (!authenticated && !oidc.requestReady)}
            style={[styles.primary, (oidc.busy || (!authenticated && !oidc.requestReady)) && styles.disabled]}
            onPress={primaryAction}
          >
            {oidc.busy ? <ActivityIndicator color="#00160D" /> : <Text style={styles.primaryText}>{authenticated ? 'Renouveler la session' : 'Connecter le compte Courier'}</Text>}
          </Pressable>
        </View>

        {safeError ? (
          <View style={styles.safeErrorCard}>
            <Text style={styles.safeErrorKicker}>DIAGNOSTIC SÛR</Text>
            <Text style={styles.safeErrorCode}>{safeError}</Text>
            <Text style={styles.safeErrorText}>Aucun token, mot de passe, code, verifier, nonce ou callback brut n’est affiché.</Text>
          </View>
        ) : null}

        <View style={styles.trustCard}>
          <Text style={styles.trustKicker}>CONFIANCE DELISHAFRICA®</Text>
          <Text style={styles.trustTitle}>Navigateur système · PKCE · SecureStore</Text>
          <Text style={styles.trustText}>Aucun token, mot de passe, verifier ou secret n’est affiché dans cette interface.</Text>
        </View>

        <Pressable disabled={oidc.busy} style={styles.secondary} onPress={oidc.restore}>
          <Text style={styles.secondaryText}>Actualiser l’état</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/orders' as any)}>
          <Text style={styles.secondaryText}>Ouvrir les missions</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/courier-space' as any)}>
          <Text style={styles.secondaryText}>Ouvrir le terrain</Text>
        </Pressable>
        {authenticated ? (
          <Pressable disabled={oidc.busy} style={styles.logout} onPress={oidc.logout}>
            <Text style={styles.logoutText}>Déconnecter ce compte</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  page: { padding: 22, paddingBottom: 72 },
  brand: { color: ACCENT, fontSize: 13, fontWeight: '900', letterSpacing: 3.4, marginTop: 12 },
  title: { color: '#F4FFF7', fontSize: 44, lineHeight: 49, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#91B39C', fontSize: 18, lineHeight: 28, fontWeight: '700', marginTop: 18 },
  statusCard: { marginTop: 26, minHeight: 112, borderRadius: 28, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(5,36,23,0.67)', borderWidth: 0.35, borderColor: 'rgba(117,239,164,0.060)' },
  statusCardReady: { backgroundColor: 'rgba(6,46,28,0.70)', borderColor: 'rgba(117,239,164,0.14)' },
  dot: { width: 13, height: 13, borderRadius: 99, backgroundColor: '#D6A957' },
  dotReady: { backgroundColor: '#75EFA4' },
  statusCopy: { flex: 1 },
  statusKicker: { color: '#75EFA4', fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  statusText: { color: '#B3C9BA', fontSize: 15, lineHeight: 22, fontWeight: '800', marginTop: 7 },
  statusFlag: { color: '#F4D17C', fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  identityCard: { marginTop: 18, borderRadius: 34, padding: 24, backgroundColor: 'rgba(232,255,240,0.835)', borderWidth: 0.35, borderColor: 'rgba(117,239,164,0.050)' },
  cardKicker: { color: '#177A45', fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  identityTitle: { color: '#002312', fontSize: 38, lineHeight: 43, fontWeight: '900', marginTop: 18 },
  identityBody: { color: '#557261', fontSize: 17, lineHeight: 26, fontWeight: '700', marginTop: 16 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 22 },
  metric: { flex: 1, borderRadius: 20, padding: 16, backgroundColor: 'rgba(0,35,18,0.06)' },
  metricLabel: { color: '#2A8252', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  metricValue: { color: '#002312', fontSize: 21, fontWeight: '900', marginTop: 8 },
  primary: { minHeight: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#75EFA4', marginTop: 22 },
  primaryText: { color: '#00160D', fontSize: 17, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  safeErrorCard: { marginTop: 18, borderRadius: 24, padding: 18, backgroundColor: '#2A1712', borderWidth: 1, borderColor: 'rgba(244,209,124,0.45)' },
  safeErrorKicker: { color: '#F4D17C', fontSize: 10, fontWeight: '900', letterSpacing: 2.0 },
  safeErrorCode: { color: '#FFF4D1', fontSize: 15, lineHeight: 21, fontWeight: '900', marginTop: 8 },
  safeErrorText: { color: '#CEBFA4', fontSize: 12, lineHeight: 18, marginTop: 8 },
  trustCard: { marginTop: 18, borderRadius: 28, padding: 22, backgroundColor: 'rgba(5,36,23,0.65)', borderWidth: 0.35, borderColor: 'rgba(117,239,164,0.045)' },
  trustKicker: { color: '#75EFA4', fontSize: 10, fontWeight: '900', letterSpacing: 2.1 },
  trustTitle: { color: '#F4FFF7', fontSize: 21, lineHeight: 28, fontWeight: '900', marginTop: 12 },
  trustText: { color: '#91B39C', fontSize: 14, lineHeight: 22, marginTop: 10 },
  secondary: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(117,239,164,0.24)', marginTop: 12 },
  secondaryText: { color: '#C8FFD7', fontSize: 16, fontWeight: '900' },
  logout: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,128,128,0.30)', marginTop: 12 },
  logoutText: { color: '#FFB3B3', fontSize: 16, fontWeight: '900' },
});
