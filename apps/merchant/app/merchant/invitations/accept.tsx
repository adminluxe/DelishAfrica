import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  daMerchantOidcAccessToken,
  daMerchantOidcLogin,
  daMerchantOidcSession,
  type MerchantOidcSession,
} from '../../../utils/daMerchantOidc';

type InvitationPreview = {
  state: 'ready' | 'accepted' | 'expired' | 'revoked' | 'unavailable';
  partnerId: string;
  partnerSlug: string;
  partnerName: string;
  membershipRole: string;
  invitationStatus: string;
  contractStatus: string;
  kybStatus: string;
  expiresAt: string;
  acceptedAt: string | null;
};

type AcceptanceResult = {
  invitation: {
    invitationStatus: string;
    contractStatus: string;
    idempotentReplay: boolean;
  };
  partner: { partnerId: string; slug: string; name: string };
  membership: {
    membershipId: string;
    role: string;
    status: string;
    contractStatus: string;
    kybStatus: string;
    accessEligible: boolean;
  };
  nextStep: string;
};

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

function apiBase(): string {
  const env = (globalThis as any)?.process?.env || {};
  const raw =
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.EXPO_PUBLIC_API_URL ||
    'https://api.delishafrica.me/api/v1';
  const normalized = String(raw).replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { code: 'invalid_server_response' };
  }
  if (!response.ok) {
    const code = String(data?.code || data?.message || `http_${response.status}`);
    throw new Error(code);
  }
  return data;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function errorLabel(code: string): string {
  const labels: Record<string, string> = {
    invitation_invalid: "Cette invitation n'est pas valide.",
    invitation_expired: 'Cette invitation a expiré.',
    invitation_revoked: 'Cette invitation a été révoquée.',
    invitation_not_issued_for_authenticated_email:
      "Le compte connecté ne correspond pas à l'adresse invitée.",
    verified_merchant_email_required:
      'Votre identité partenaire doit contenir une adresse e-mail vérifiée.',
    trusted_external_merchant_identity_required:
      'Une connexion partenaire sécurisée est requise.',
    membership_reactivation_requires_ops_review:
      'Ce compte nécessite une vérification par notre équipe partenaire.',
    invitation_acceptance_writes_disabled:
      "L'acceptation est momentanément indisponible.",
  };
  return labels[code] || 'Une erreur sécurisée a interrompu cette opération.';
}

export default function MerchantInvitationAcceptScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const router = useRouter();
  const token = useMemo(() => firstParam(params.token).trim(), [params.token]);
  const tokenValid = TOKEN_RE.test(token);

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [session, setSession] = useState<MerchantOidcSession | null>(null);
  const [accepted, setAccepted] = useState<AcceptanceResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'login' | 'accept' | null>('preview');
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const next = await daMerchantOidcSession();
    setSession(next);
    return next;
  }, []);

  const loadPreview = useCallback(async () => {
    if (!tokenValid) {
      setBusy(null);
      setError('invitation_invalid');
      return;
    }
    setBusy('preview');
    setError(null);
    try {
      const data = await requestJson(`${apiBase()}/merchant-invitations/accept/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setPreview(data.invitation as InvitationPreview);
      await refreshSession();
    } catch (nextError: any) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusy(null);
    }
  }, [refreshSession, token, tokenValid]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const login = useCallback(async () => {
    setBusy('login');
    setError(null);
    try {
      const next = await daMerchantOidcLogin();
      setSession(next);
    } catch (nextError: any) {
      setError(String(nextError?.message || nextError));
    } finally {
      setBusy(null);
    }
  }, []);

  const accept = useCallback(async () => {
    setBusy('accept');
    setError(null);
    try {
      let accessToken = await daMerchantOidcAccessToken();
      if (!accessToken) {
        const next = await daMerchantOidcLogin();
        setSession(next);
        accessToken = await daMerchantOidcAccessToken();
      }
      if (!accessToken) throw new Error('trusted_external_merchant_identity_required');
      const data = await requestJson(`${apiBase()}/merchant-invitations/accept`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-request-id': `merchant-app-${Date.now()}`,
        },
        body: JSON.stringify({ token }),
      });
      setAccepted(data as AcceptanceResult);
      await loadPreview();
    } catch (nextError: any) {
      setError(String(nextError?.message || nextError));
      await refreshSession().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }, [loadPreview, refreshSession, token]);

  const ready = preview?.state === 'ready';
  const alreadyAccepted = preview?.state === 'accepted' || Boolean(accepted);
  const authenticated = session?.authenticated === true && session.source === 'external';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.badge}>INVITATION SÉCURISÉE</Text>
        </View>

        <Text style={styles.title}>Bienvenue dans l’espace partenaire.</Text>
        <Text style={styles.subtitle}>
          Vérifiez le contrat d’invitation, connectez votre identité Merchant puis confirmez votre rattachement.
        </Text>

        {busy === 'preview' ? (
          <View style={styles.centerCard}>
            <ActivityIndicator />
            <Text style={styles.muted}>Vérification de l’invitation…</Text>
          </View>
        ) : null}

        {preview ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>PARTENAIRE</Text>
            <Text style={styles.partner}>{preview.partnerName}</Text>
            <View style={styles.line}>
              <Text style={styles.label}>Rôle proposé</Text>
              <Text style={styles.value}>{preview.membershipRole}</Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.label}>Expiration</Text>
              <Text style={styles.value}>{formatDate(preview.expiresAt)}</Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.label}>État</Text>
              <Text style={styles.value}>{preview.state}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>IDENTITÉ MERCHANT</Text>
          <Text style={styles.partner}>
            {authenticated ? 'Identité partenaire vérifiée' : 'Connexion sécurisée requise'}
          </Text>
          <Text style={styles.muted}>
            {session?.user?.email ||
              'L’adresse vérifiée de votre identité doit correspondre à celle qui a reçu l’invitation.'}
          </Text>
          {!authenticated && ready ? (
            <Pressable
              disabled={Boolean(busy)}
              onPress={login}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              {busy === 'login' ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Se connecter</Text>}
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Action interrompue</Text>
            <Text style={styles.errorText}>{errorLabel(error)}</Text>
          </View>
        ) : null}

        {accepted ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Invitation acceptée</Text>
            <Text style={styles.successText}>
              Votre contrat est accepté. Votre membership est créé avec le statut {accepted.membership.status}.
              L’accès opérationnel sera activé après validation KYB.
            </Text>
          </View>
        ) : null}

        {ready ? (
          <Pressable
            disabled={Boolean(busy)}
            onPress={accept}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            {busy === 'accept' ? (
              <ActivityIndicator color="#180b05" />
            ) : (
              <Text style={styles.primaryText}>Accepter l’invitation</Text>
            )}
          </Pressable>
        ) : null}

        {alreadyAccepted ? (
          <Pressable onPress={() => router.replace('/')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Entrer dans l’espace Merchant</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.replace('/')} style={styles.linkButton}>
          <Text style={styles.linkText}>Retour à DelishAfrica Merchant</Text>
        </Pressable>

        <Text style={styles.legal}>
          L’acceptation ne contourne pas les contrôles KYB. Aucun accès opérationnel n’est activé avant vérification.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#160A05' },
  content: { padding: 22, paddingBottom: 48, gap: 16 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  brand: { color: '#F8D9A4', fontSize: 15, fontWeight: '800', letterSpacing: 1.2 },
  badge: { color: '#FFD7A0', fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: '#81512E', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  title: { color: '#FFF7EA', fontSize: 32, lineHeight: 38, fontWeight: '800', marginTop: 10 },
  subtitle: { color: '#CDB8A8', fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: '#24120B', borderWidth: 1, borderColor: '#4D2B1B', borderRadius: 22, padding: 18, gap: 12 },
  centerCard: { backgroundColor: '#24120B', borderRadius: 22, padding: 24, alignItems: 'center', gap: 12 },
  eyebrow: { color: '#C78E55', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  partner: { color: '#FFF7EA', fontSize: 21, fontWeight: '800' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { color: '#9F8879', fontSize: 13 },
  value: { color: '#F0DAC8', fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  muted: { color: '#A99283', fontSize: 13, lineHeight: 20 },
  primaryButton: { backgroundColor: '#F6C77C', minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#180B05', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#8B5A35', minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { color: '#F7D6A5', fontSize: 15, fontWeight: '800' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#D8A66B', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  errorCard: { backgroundColor: '#3A1515', borderWidth: 1, borderColor: '#8E3434', borderRadius: 18, padding: 16, gap: 6 },
  errorTitle: { color: '#FFD2D2', fontSize: 15, fontWeight: '900' },
  errorText: { color: '#F0BABA', fontSize: 13, lineHeight: 20 },
  successCard: { backgroundColor: '#143124', borderWidth: 1, borderColor: '#2F805B', borderRadius: 18, padding: 16, gap: 6 },
  successTitle: { color: '#C7F7D8', fontSize: 16, fontWeight: '900' },
  successText: { color: '#A9DDBD', fontSize: 13, lineHeight: 20 },
  legal: { color: '#735F53', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
});
