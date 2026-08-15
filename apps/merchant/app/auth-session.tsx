import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  daAuthAccent,
  daAuthHealth,
  daAuthLabel,
  daDevLogin,
  daLogout,
  daMe,
  daVerify,
  type DaAuthSession,
} from '../utils/daAuthBridge';
import {
  daMerchantOidcConstants,
  daMerchantOidcLogin,
  daMerchantOidcLogout,
  daMerchantOidcRefresh,
  daMerchantOidcRuntimeStatus,
  daMerchantOidcSession,
  type MerchantOidcSession,
} from '../utils/daMerchantOidc';

export default function AuthSessionScreen() {
  const accent = daAuthAccent();
  const constants = useMemo(() => daMerchantOidcConstants(), []);
  const runtime = useMemo(() => daMerchantOidcRuntimeStatus(), []);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [session, setSession] = useState<DaAuthSession | null>(null);
  const [oidc, setOidc] = useState<MerchantOidcSession | null>(null);
  const [trace, setTrace] = useState<string[]>([]);

  const push = (line: string) => {
    setTrace((previous) => [
      `${new Date().toLocaleTimeString()} · ${line}`,
      ...previous,
    ].slice(0, 10));
  };

  async function refreshAll() {
    const [nextHealth, nextOidc, nextSession] = await Promise.all([
      daAuthHealth(),
      daMerchantOidcSession(),
      daMe(),
    ]);
    setHealth(nextHealth);
    setOidc(nextOidc);
    setSession(nextSession);
  }

  async function run(label: string, fn: () => Promise<any>) {
    setLoading(true);
    try {
      push(label);
      const data = await fn();
      await refreshAll();
      push(`OK ${label}`);
      return data;
    } catch (error: any) {
      const message = String(error?.message || error);
      push(`ERR ${label} · ${message}`);
      Alert.alert('Session Merchant', message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    refreshAll().catch((error: any) => {
      if (alive) push(`Init · ${String(error?.message || error)}`);
    });
    return () => {
      alive = false;
    };
  }, []);

  const realUser = oidc?.user || null;
  const apiUser = session?.user || null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA® MERCHANT</Text>
        <Text style={styles.title}>Identité partenaire</Text>
        <Text style={styles.subtitle}>
          Connexion réelle via navigateur système, Authorization Code et PKCE S256.
        </Text>
        <View style={[styles.badge, { borderColor: accent }]}>
          <Text style={[styles.badgeText, { color: accent }]}>OIDC · MERCHANT</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Socle de confiance</Text>
        <Text style={styles.line}>Issuer : Keycloak AfriTaste public</Text>
        <Text style={styles.line}>Client : {constants.clientId}</Text>
        <Text style={styles.line}>PKCE : S256 obligatoire</Text>
        <Text style={styles.line}>Redirect : {constants.redirectUri}</Text>
        <Text style={styles.line}>Vérificateur API : {health?.trustedIdentity?.ready ? 'prêt' : 'indisponible'}</Text>
        <Text style={styles.line}>Ownership dev-login : {health?.devLoginOwnershipEligible === false ? 'interdit' : 'inconnu'}</Text>
      </View>

      {!runtime.ready ? (
        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.warningTitle}>Rebuild Merchant requis</Text>
          <Text style={styles.warning}>
            Le code OIDC est installé, mais le Dev Client actuel ne contient pas encore tous les modules natifs.
          </Text>
          <Text style={styles.muted}>{runtime.reason || 'module natif indisponible'}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Merchant réelle</Text>
        <Text style={styles.line}>Authentifié : {oidc?.authenticated ? 'oui' : 'non'}</Text>
        <Text style={styles.line}>Source : {session?.source || oidc?.source || 'aucune'}</Text>
        <Text style={styles.line}>Utilisateur : {realUser?.name || apiUser?.name || 'aucun'}</Text>
        <Text style={styles.line}>Email : {realUser?.email || apiUser?.email || '-'}</Text>
        <Text style={styles.line}>Rôle : {realUser?.role || apiUser?.role || '-'}</Text>
        <Text style={styles.line}>Refresh disponible : {oidc?.refreshTokenPresent ? 'oui' : 'non'}</Text>
        <Text style={styles.line}>Ownership éligible : {session?.ownershipEligible ? 'oui' : 'non'}</Text>
        {oidc?.reason ? <Text style={styles.muted}>Info : {oidc.reason}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={loading || !runtime.ready}
          style={[styles.button, { backgroundColor: runtime.ready ? accent : '#5B4637' }]}
          onPress={() => run('login OIDC', () => daMerchantOidcLogin())}
        >
          <Text style={styles.buttonText}>Se connecter comme partenaire</Text>
        </Pressable>

        <Pressable
          disabled={loading || !runtime.ready || !oidc?.refreshTokenPresent}
          style={styles.secondaryButton}
          onPress={() => run('refresh OIDC', () => daMerchantOidcRefresh())}
        >
          <Text style={styles.secondaryText}>Rafraîchir la session réelle</Text>
        </Pressable>

        <Pressable
          disabled={loading}
          style={styles.secondaryButton}
          onPress={() => run('verify API', () => daVerify())}
        >
          <Text style={styles.secondaryText}>Vérifier avec l’API</Text>
        </Pressable>

        <Pressable
          disabled={loading || !runtime.ready}
          style={styles.dangerButton}
          onPress={() => run('logout OIDC', () => daMerchantOidcLogout())}
        >
          <Text style={styles.dangerText}>Déconnexion Merchant + IdP</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session de développement isolée</Text>
        <Text style={styles.muted}>
          Conservée pour les tests internes. Elle reste inéligible à l’ownership et ne remplace jamais l’identité externe.
        </Text>
        <Pressable
          disabled={loading}
          style={styles.devButton}
          onPress={() => run('dev-login isolé', () => daDevLogin())}
        >
          <Text style={styles.devButtonText}>Activer dev-login isolé</Text>
        </Pressable>
        <Pressable
          disabled={loading}
          style={styles.devButton}
          onPress={() => run('logout dev local', () => daLogout())}
        >
          <Text style={styles.devButtonText}>Effacer dev-login local</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 18 }} color={accent} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trace locale sans token</Text>
        {trace.length === 0 ? (
          <Text style={styles.muted}>Aucune action pour l’instant.</Text>
        ) : (
          trace.map((line, index) => <Text key={`${line}-${index}`} style={styles.trace}>{line}</Text>)
        )}
      </View>

      <Text style={styles.footer}>
        Aucun utilisateur, ownership, brouillon ou contenu publié n’est créé automatiquement.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#070707' },
  content: { paddingHorizontal: 20, paddingTop: 42, paddingBottom: 40 },
  hero: {
    marginTop: 28,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#14110D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 16,
  },
  kicker: { color: '#F4B56A', fontWeight: '900', letterSpacing: 1.4, fontSize: 12 },
  title: { color: '#FFF8EF', fontSize: 28, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#C9B8A5', lineHeight: 21, marginTop: 8 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 14 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  card: { backgroundColor: '#121212', borderRadius: 20, padding: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 14 },
  warningCard: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(120,53,15,0.20)' },
  warningTitle: { color: '#FBBF24', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  cardTitle: { color: '#FFF8EF', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  line: { color: '#E8DDD1', marginBottom: 7, lineHeight: 19 },
  muted: { color: '#948A80', lineHeight: 19 },
  warning: { color: '#FDE68A', lineHeight: 20, marginBottom: 8 },
  actions: { gap: 10, marginBottom: 14 },
  button: { borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { color: '#140B05', fontWeight: '900', fontSize: 15 },
  secondaryButton: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(217,137,61,0.45)', backgroundColor: 'rgba(217,137,61,0.10)' },
  secondaryText: { color: '#F4B56A', fontWeight: '800' },
  dangerButton: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(127,29,29,0.18)' },
  dangerText: { color: '#FCA5A5', fontWeight: '800' },
  devButton: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
  devButtonText: { color: '#B8ADA2', textAlign: 'center', fontWeight: '700' },
  trace: { color: '#B8ADA2', fontSize: 12, lineHeight: 18, marginBottom: 5 },
  footer: { color: '#766E66', textAlign: 'center', fontSize: 12, lineHeight: 18, paddingHorizontal: 8 },
});
