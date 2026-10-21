import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { daMerchantOidcAccessToken, daMerchantOidcForgetLocalSession } from '../utils/daMerchantOidc';

const APPLICATION = 'merchant' as const;
const EXPECTED_PACKAGE = 'com.delishafrica.merchant';
const API_BASE = 'https://api.delishafrica.me/api/v1';
const DELETE_CONFIRMATION = 'DELETE_MY_DELISHAFRICA_ACCOUNT';

type DeletionResponse = {
  ok?: boolean;
  requestId?: string;
  status?: string;
  identityDeletionUrl?: string;
};

function currentPackage(): string {
  return String(
    Constants.expoConfig?.ios?.bundleIdentifier ||
      Constants.expoConfig?.android?.package ||
      '',
  );
}

function trustedDeletionUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'keycloak.afritaste.delishafrica.me' ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    if (!url.pathname.startsWith('/realms/afritaste/account/')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function jsonSafe(response: Response): Promise<DeletionResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function requestDeletion(token: string): Promise<DeletionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_BASE}/account-deletion/requests/${APPLICATION}`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': `da-delete-${Crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        confirmation: DELETE_CONFIRMATION,
        acknowledgeRetention: true,
      }),
    });
    const body = await jsonSafe(response);
    if (
      response.status !== 202 ||
      response.redirected ||
      body.ok !== true ||
      typeof body.requestId !== 'string' ||
      body.requestId.length < 16 ||
      !trustedDeletionUrl(body.identityDeletionUrl)
    ) {
      throw new Error('account_deletion_request_rejected');
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export default function AccountDeletion() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const productionPackage = useMemo(() => currentPackage() === EXPECTED_PACKAGE, []);

  const submit = async () => {
    if (busy) return;
    if (!productionPackage) {
      setNotice('La suppression de compte est verrouillée dans cette variante. Utilisez la version officielle DelishAfrica®.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const token = await daMerchantOidcAccessToken();
      if (!token) {
        setNotice('Votre session a expiré. Reconnectez-vous avant de demander la suppression du compte.');
        return;
      }

      const result = await requestDeletion(token);
      const deletionUrl = trustedDeletionUrl(result.identityDeletionUrl);
      if (!deletionUrl) throw new Error('account_deletion_url_untrusted');

      setNotice('Votre demande de suppression a été enregistrée. Terminez maintenant la suppression de votre identité dans le centre sécurisé.');
      await WebBrowser.openBrowserAsync(deletionUrl);
      await daMerchantOidcForgetLocalSession();
      router.replace('/onboarding' as any);
    } catch (error) {
      const raw = String(error instanceof Error ? error.message : error || '');
      setNotice(
        /AbortError|aborted|timeout/i.test(raw)
          ? 'Le service de suppression met trop de temps à répondre. Rien n’a été confirmé. Réessayez.'
          : 'La demande de suppression n’a pas pu être enregistrée. Aucun compte n’a été supprimé. Réessayez après vous être reconnecté.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (busy) return;
    Alert.alert(
      'Supprimer définitivement mon compte ?',
      'Votre identité DelishAfrica® sera supprimée. Certaines données peuvent être conservées uniquement lorsqu’une obligation légale, comptable, antifraude ou contentieuse l’impose.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => { void submit(); },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>DELISHAFRICA® · VOS DROITS</Text>
        <Text style={styles.title}>Supprimer mon compte</Text>
        <Text style={styles.lead}>
          Vous pouvez initier ici la suppression définitive de votre identité DelishAfrica®.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Avant de confirmer</Text>
          <Text style={styles.body}>
            La demande est d’abord enregistrée côté DelishAfrica® avec une trace réglementaire idempotente, puis le centre
            d’identité sécurisé vous permet de supprimer votre compte après réauthentification.
          </Text>
          <Text style={styles.body}>
            Les données que la loi nous impose de conserver, notamment certaines pièces comptables ou éléments de lutte
            contre la fraude, suivent leurs délais légaux de conservation et ne servent plus à l’accès au compte.
          </Text>

          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <Pressable
            testID="account-delete-open"
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            style={[styles.danger, busy && styles.disabled]}
            onPress={confirm}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerText}>Demander la suppression sécurisée</Text>
            )}
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" style={styles.back} disabled={busy} onPress={() => router.back()}>
          <Text style={styles.backText}>← Revenir</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9F2' },
  content: { padding: 24, paddingBottom: 52 },
  kicker: { color: '#8B4A24', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: '#17110D', fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 10 },
  lead: { color: '#6C5A4E', fontSize: 15, lineHeight: 23, marginTop: 12 },
  card: { marginTop: 24, padding: 20, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAD9C8' },
  cardTitle: { color: '#25170F', fontSize: 18, fontWeight: '900' },
  body: { color: '#67594F', fontSize: 14, lineHeight: 22, marginTop: 12 },
  notice: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#FFF1DE', borderWidth: 1, borderColor: '#E8C79B' },
  noticeText: { color: '#5B3B20', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  danger: { marginTop: 20, minHeight: 56, borderRadius: 16, backgroundColor: '#7F231C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  disabled: { opacity: 0.58 },
  dangerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  back: { minHeight: 50, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#6C4A37', fontSize: 14, fontWeight: '800' },
});
