import React, { useEffect, useState } from 'react';
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
  daAuthApiBase,
  daAuthHealth,
  daAuthLabel,
  daAuthRole,
  daDevLogin,
  daLogout,
  daMe,
  daVerify,
  type DaAuthSession,
} from '../utils/daAuthBridge';

export default function AuthSessionScreen() {
  const accent = daAuthAccent();
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [session, setSession] = useState<DaAuthSession | null>(null);
  const [trace, setTrace] = useState<string[]>([]);

  const push = (line: string) => {
    setTrace((prev) => [new Date().toLocaleTimeString() + ' · ' + line, ...prev].slice(0, 8));
  };

  async function run(label: string, fn: () => Promise<any>) {
    setLoading(true);
    try {
      push(label);
      const data = await fn();
      setSession(data);
      push('OK ' + label);
      return data;
    } catch (e: any) {
      push('ERR ' + label + ' · ' + String(e?.message || e));
      Alert.alert('Auth session', String(e?.message || e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const h = await daAuthHealth();
        if (mounted) setHealth(h);
        const me = await daMe();
        if (mounted) setSession(me);
      } catch (e: any) {
        push('Init error · ' + String(e?.message || e));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const user = session?.user || null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Session progressive</Text>
        <Text style={styles.subtitle}>
          Auth progressive pour {daAuthLabel()}.
        </Text>

        <View style={[styles.badge, { borderColor: accent }]}>
          <Text style={[styles.badgeText, { color: accent }]}>
            ROLE · {daAuthRole().toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session sécurisée</Text>
        <Text style={styles.muted}>{daAuthApiBase()}</Text>
        <Text style={styles.line}>
          Health : {health?.ok ? 'OK' : 'en attente'}
        </Text>
        <Text style={styles.line}>
          Mode : {health?.mode || 'progressive'}
        </Text>
        <Text style={styles.line}>
          Connexion obligatoire : {health?.required === false ? 'non' : 'non définie'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session actuelle</Text>
        <Text style={styles.line}>
          Authentifié : {session?.authenticated ? 'oui' : 'non'}
        </Text>
        <Text style={styles.line}>
          Required : {session?.required === false ? 'non' : 'non'}
        </Text>
        <Text style={styles.line}>
          User : {user?.name || 'aucun'}
        </Text>
        <Text style={styles.line}>
          ID : {user?.id || '-'}
        </Text>
        <Text style={styles.line}>
          Rôle : {user?.role || '-'}
        </Text>
        {session?.reason ? <Text style={styles.warning}>Info : {session.reason}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={loading}
          style={[styles.button, { backgroundColor: accent }]}
          onPress={() => run('dev-login', () => daDevLogin())}
        >
          <Text style={styles.buttonText}>Activer session {daAuthRole()}</Text>
        </Pressable>

        <Pressable
          disabled={loading}
          style={styles.secondaryButton}
          onPress={() => run('me', () => daMe())}
        >
          <Text style={styles.secondaryText}>Rafraîchir /me</Text>
        </Pressable>

        <Pressable
          disabled={loading}
          style={styles.secondaryButton}
          onPress={() => run('verify', () => daVerify())}
        >
          <Text style={styles.secondaryText}>Vérifier token</Text>
        </Pressable>

        <Pressable
          disabled={loading}
          style={styles.dangerButton}
          onPress={() =>
            run('logout', async () => {
              await daLogout();
              return await daMe();
            })
          }
        >
          <Text style={styles.dangerText}>Déconnecter localement</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 18 }} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trace locale</Text>
        {trace.length === 0 ? (
          <Text style={styles.muted}>Aucune action pour l’instant.</Text>
        ) : (
          trace.map((line, index) => (
            <Text key={index} style={styles.trace}>
              {line}
            </Text>
          ))
        )}
      </View>

      <Text style={styles.footer}>
        Cette session prépare l’auth réelle sans bloquer les espaces Lite ni le flow commande.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#070707',
  },
  content: { paddingHorizontal: 20, paddingTop: 42, paddingBottom: 36 },
  hero: {
    marginTop: 28, borderRadius: 24, padding: 18,
    backgroundColor: '#14110D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 16,
  },
  kicker: {
    color: '#D6B16A',
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25, fontWeight: '900',
    marginTop: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  badgeText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 20, padding: 14,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginTop: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  muted: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 13,
    lineHeight: 20,
  },
  line: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 22,
  },
  warning: {
    color: '#F2B84B',
    marginTop: 6,
    fontSize: 13,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
  button: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
  },
  secondaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  dangerButton: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,90,90,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.26)',
  },
  dangerText: {
    color: '#FF9A9A',
    fontWeight: '800',
    fontSize: 14,
  },
  trace: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    color: 'rgba(255,255,255,0.44)',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
  },
});
