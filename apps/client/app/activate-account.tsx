import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { daAccountStorageKey } from '../utils/daOrdersApi';
import { daCanonicalContact, daLocalProofFresh } from '../utils/daProofIdentity';
import { daAttestIdentityProof, type DaIdentityProof } from '../utils/daTrustNetwork';

type ClientEnrollmentProfile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
  proofs?: { phone?: DaIdentityProof; email?: DaIdentityProof };
};

const PROFILE_BASE = '__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__';
const API_BASE = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    'https://api.delishafrica.me/api/v1',
).replace(/\/+$/, '').replace(/\/api\/v1$/, '') + '/api/v1';

export default function ActivateClientAccountScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [profile, setProfile] = useState<ClientEnrollmentProfile | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const flight = useRef(false);
  const requestId = useRef(Crypto.randomUUID());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const storageKey = await daAccountStorageKey(PROFILE_BASE);
      const raw = await SecureStore.getItemAsync(storageKey);
      const parsed = raw ? JSON.parse(raw) as ClientEnrollmentProfile : null;
      setProfile(parsed);
      const response = await fetch(API_BASE + '/client-enrollment/readiness');
      const json = await response.json().catch(() => ({}));
      setReady(response.ok && json?.enabled === true);
    } catch {
      setReady(false);
      setNotice('La création de compte est momentanément indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const email = daCanonicalContact('email', profile?.email);
  const phone = daCanonicalContact('sms', profile?.phone);
  const verified = Boolean(
    profile?.consent === true &&
    daLocalProofFresh('email', profile?.proofs?.email, email) &&
    daLocalProofFresh('sms', profile?.proofs?.phone, phone),
  );

  const register = useCallback(async () => {
    if (flight.current || busy) return;
    if (!profile || !verified) {
      Alert.alert('Contacts à confirmer', 'Vérifiez votre téléphone et votre e-mail dans Mon espace.');
      router.push({ pathname: '/client-space', params: { returnTo: returnTo === 'checkout' ? 'checkout' : 'space' } } as any);
      return;
    }
    if (!ready) {
      Alert.alert('Activation en préparation', 'La création sécurisée de comptes est momentanément indisponible.');
      return;
    }
    if (password.length < 12 || password.length > 128 ||
        !/\p{L}/u.test(password) || !/[0-9\p{P}\p{S}]/u.test(password) ||
        password !== confirm) {
      Alert.alert('Sécurité du compte', 'Choisissez une phrase secrète de 12 caractères minimum, avec une lettre et un chiffre ou symbole, puis confirmez-la.');
      return;
    }

    flight.current = true;
    setBusy(true);
    setNotice('Vérification de votre identité…');
    try {
      const [proofEmail, proofSms] = await Promise.all([
        daAttestIdentityProof({
          role: 'client', channel: 'email', destination: email,
          proofToken: profile.proofs!.email!.token,
        }),
        daAttestIdentityProof({
          role: 'client', channel: 'sms', destination: phone,
          proofToken: profile.proofs!.phone!.token,
        }),
      ]);
      if (proofEmail.valid !== true || proofSms.valid !== true) {
        setNotice('Les preuves ne sont plus valides. Reconfirmez vos contacts dans Mon espace.');
        return;
      }

      const res = await fetch(API_BASE + '/client-enrollment/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email, phone,
          firstName: String(profile.firstName || '').trim(),
          lastName: String(profile.lastName || '').trim(),
          emailProofToken: profile.proofs!.email!.token,
          smsProofToken: profile.proofs!.phone!.token,
          password,
          requestId: requestId.current,
          acceptTerms: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'account_created') {
        setNotice(res.status === 409
          ? 'Une activation existe déjà pour ces contacts. Essayez de vous connecter ou demandez de l’aide.'
          : 'L’activation ne peut pas être terminée pour le moment. Aucun paiement n’a été effectué.');
        return;
      }
      setPassword('');
      setConfirm('');
      Alert.alert(
        'Bienvenue chez DelishAfrica',
        'Votre compte est créé. Connectez-vous pour reprendre votre commande en toute sécurité.',
        [{
          text: 'Me connecter',
          onPress: () => router.replace({
            pathname: '/secure-session',
            params: { returnTo: returnTo === 'checkout' ? 'checkout' : 'space' },
          } as any),
        }],
      );
    } catch {
      setNotice('Le réseau est indisponible. Réessayez sans changer de compte.');
    } finally {
      setBusy(false);
      flight.current = false;
      setPassword('');
      setConfirm('');
    }
  }, [busy, confirm, email, password, phone, profile, ready, router, returnTo, verified]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Votre compte, votre liberté.</Text>
        <Text style={styles.subtitle}>
          Deux contacts vérifiés, une seule activation. Vos prochaines commandes en toute simplicité.
          Votre phrase secrète reste privée.
        </Text>

        <View style={styles.card}>
          <Text style={styles.kicker}>ACTIVATION DE VOTRE COMPTE</Text>
          {loading ? <ActivityIndicator color="#EAC775" /> : (
            <>
              <Text style={styles.value}>{profile?.firstName || 'Bienvenue'}</Text>
              <Text style={styles.detail}>E-mail {daLocalProofFresh('email', profile?.proofs?.email, email) ? 'confirmé ✓' : 'à confirmer'}</Text>
              <Text style={styles.detail}>Téléphone {daLocalProofFresh('sms', profile?.proofs?.phone, phone) ? 'confirmé ✓' : 'à confirmer'}</Text>
              {ready === false ? (
                <Text style={styles.warning}>Vos coordonnées sont conservées. L’activation des comptes arrive bientôt. Votre panier reste disponible.</Text>
              ) : null}
              {!verified && ready ? <Text style={styles.warning}>Confirmez vos deux contacts une fois pour activer votre compte.</Text> : null}
            </>
          )}
        </View>

        {ready && verified ? <View style={styles.card}>
          <Text style={styles.kicker}>CHOISIR MA PHRASE SECRÈTE</Text>
          <Text style={styles.hint}>12 caractères minimum. Jamais enregistrée dans l’application.</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder="Ma phrase secrète"
            placeholderTextColor="#82988D"
          />
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder="Confirmer ma phrase secrète"
            placeholderTextColor="#82988D"
          />
          <Text style={styles.hint}>Ce compte ne peut donner accès qu’à l’espace Client.</Text>
        </View> : null}

        {notice ? <Text style={styles.warning}>{notice}</Text> : null}
        {ready && verified ? <Pressable
          accessibilityRole="button"
          disabled={busy || loading}
          onPress={() => { void register(); }}
          style={[styles.primary, (busy || loading) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#062016" /> : (
            <Text style={styles.primaryText}>Activer mon compte DelishAfrica</Text>
          )}
        </Pressable> : null}
        <Pressable style={styles.secondary} onPress={() => router.replace({ pathname: '/client-space', params: { returnTo: returnTo === 'checkout' ? 'checkout' : 'space' } } as any)}>
          <Text style={styles.secondaryText}>Vérifier mes contacts</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace({ pathname: '/secure-session', params: { returnTo: returnTo === 'checkout' ? 'checkout' : 'space' } } as any)}>
          <Text style={styles.secondaryText}>J’ai déjà un compte</Text>
        </Pressable>
        <Text style={styles.foot}>Le paiement reste volontaire. Il ne démarre jamais pendant l’inscription.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#051910' },
  page: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 64 },
  brand: { color: '#EAC775', fontSize: 17, fontWeight: '900', letterSpacing: 5 },
  title: { color: '#FFF9E7', fontSize: 39, lineHeight: 46, fontWeight: '900', marginTop: 20 },
  subtitle: { color: '#B8D0C0', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 20 },
  card: { backgroundColor: '#103225', borderColor: '#3B6651', borderWidth: 1, borderRadius: 24, padding: 18, marginVertical: 8 },
  kicker: { color: '#EAC775', fontSize: 11, fontWeight: '900', letterSpacing: 1.9, marginBottom: 10 },
  value: { color: '#FFF9E7', fontSize: 23, fontWeight: '800' },
  detail: { color: '#D4E7DA', fontSize: 14, lineHeight: 22, marginTop: 8 },
  hint: { color: '#AFCEBE', fontSize: 13, lineHeight: 20 },
  warning: { color: '#F8D3A2', fontSize: 14, lineHeight: 21, marginVertical: 10 },
  input: { marginTop: 12, minHeight: 55, borderRadius: 15, paddingHorizontal: 16, color: '#FFF9E7', backgroundColor: '#071D15', borderWidth: 1, borderColor: '#4C725F' },
  primary: { minHeight: 58, backgroundColor: '#EAC775', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  primaryText: { color: '#062016', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  secondaryText: { color: '#EBDAB1', fontSize: 14, fontWeight: '800' },
  foot: { color: '#8BA79A', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});
