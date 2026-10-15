import React, { useState } from 'react';
import {
  ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';

type EntryIntent = 'register' | 'login';
const ACCENT = '#77F0B4';
const BG = '#061C14';
const NEXT_ALLOWED = new Set(['/courier-space', '/orders', '/courier-real-map']);

function friendlyFailure(value: unknown): string {
  const raw = String(value || '').toLowerCase();
  if (/cancel|dismiss/.test(raw)) return '';
  if (/role|membership|owner|tenant|permission|not_authorized|api_external/.test(raw))
    return 'Compte identifié, mais vos autorisations professionnelles doivent encore être validées.';
  if (/redirect|callback|invalid_parameter|scheme/.test(raw))
    return 'Le retour sécurisé vers cette version de l’application doit être autorisé par le fournisseur d’identité.';
  if (/discovery|network|fetch|timeout|connexion/.test(raw))
    return 'Le service d’identification est momentanément inaccessible. Vos données restent intactes.';
  return 'La connexion n’a pas pu être finalisée. Réessayez ou revenez plus tard.';
}

export default function DelishOnboardingV2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const proposed = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextRoute = proposed && NEXT_ALLOWED.has(proposed) ? proposed : '/courier-space';
  const [notice, setNotice] = useState('');
  const auth = useDaPkceAuth();
  const verified = auth.session.status === 'authenticated';
  const busy = auth.busy;
  const ready = auth.requestReady && Boolean(auth.redirectUri);
  const identityName = auth.session.displayName || auth.session.email || '';
  const accessStatus = verified ? 'IDENTITÉ VÉRIFIÉE' : 'IDENTITÉ À CONNECTER';
  const canOpen = ready && !busy && !(auth.session.status === 'anonymous' && auth.session.reason === 'initializing');
  async function begin(intent: EntryIntent) {
    if (!canOpen) return;
    setNotice('');
    const result = await auth.signIn(intent);
    if (result.status === 'authenticated') {
      router.replace(nextRoute as any);
    } else if (result.status === 'error') {
      const safe = friendlyFailure(result.reason);
      if (safe) setNotice(safe);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ImageBackground source={require('../assets/h2o/courier-h2o-premium-v1.png')} style={styles.background} imageStyle={styles.backgroundImage} resizeMode="cover">
        <View style={styles.veil}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.brand}>DELISHAFRICA® · LIVREUR</Text>
            <Text style={styles.pill}>DÉMARRAGE SIMPLE · V2</Text>
            <Text style={styles.title}>Prenez la route.</Text>
            <Text style={styles.subtitle}>Une identité, puis vos missions. Pas de faux revenu, pas de fausse course.</Text>
            <View style={styles.progress}>
              <Text style={styles.progressLabel}>Votre entrée en service</Text>
              {['Créer ou retrouver mon identité', 'Faire valider mon profil et ma zone', 'Recevoir les missions attribuées'].map((step, index) => (
                <View key={step} style={styles.progressRow}>
                  <View style={[styles.number, index === 0 && styles.numberActive]}><Text style={styles.numberText}>{index + 1}</Text></View>
                  <Text style={styles.progressText}>{step}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>{accessStatus}</Text>
              <Text style={styles.cardTitle}>{verified ? 'Votre session est active.' : 'Commençons par votre compte.'}</Text>
              <Text style={styles.cardDescription}>
                {verified ? identityName || 'Votre identité sécurisée est disponible.' : 'Deux choix. Aucun mot de passe n’est demandé ni conservé dans l’application.'}
              </Text>
              {verified ? (
                <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.replace(nextRoute as any)}>
                  <Text style={styles.primaryText}>Compléter mon profil livreur →</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable accessibilityRole="button" accessibilityState={{disabled: !canOpen}} disabled={!canOpen} style={[styles.primary, !canOpen && styles.disabled]} onPress={() => void begin('register')}>
                    {busy ? <ActivityIndicator color={BG} /> : <Text style={styles.primaryText}>Créer mon compte →</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{disabled: !canOpen}} disabled={!canOpen} style={[styles.outline, !canOpen && styles.disabled]} onPress={() => void begin('login')}>
                    <Text style={styles.outlineText}>J’ai déjà un compte</Text>
                  </Pressable>
                </>
              )}
              {!ready ? <Text style={styles.warn}>L’identification est en préparation. Réessayez quand la connexion sécurisée est disponible.</Text> : null}
              {notice ? <Text accessibilityRole="alert" style={styles.warn}>{notice}</Text> : null}
              <Text style={styles.trust}>Votre rôle et votre zone doivent être validés côté serveur avant toute mission ou rémunération.</Text>
              <Text style={styles.roleNote}>Créer un compte ne donne pas automatiquement accès aux courses. Le contrôle professionnel reste obligatoire.</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.replace('/orders' as any)}>
              <Text style={styles.secondaryText}>Voir le terrain ↗</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.legal} onPress={() => router.push('/legal' as any)}>
              <Text style={styles.legalText}>Confidentialité · Conditions · Assistance</Text>
            </Pressable>
            <Text style={styles.footnote}>Identification : navigateur système, Authorization Code + PKCE. Aucune activation financière implicite.</Text>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  background: { flex: 1 },
  backgroundImage: { opacity: 0.23 },
  veil: { flex: 1, backgroundColor: 'rgba(1,9,11,0.76)' },
  page: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 54 },
  brand: { color: ACCENT, fontWeight: '900', fontSize: 12, letterSpacing: 2.1 },
  pill: { alignSelf: 'flex-start', color: ACCENT, marginTop: 28, fontWeight: '900', fontSize: 11, letterSpacing: 2.1 },
  title: { color: '#FFF9F0', fontWeight: '900', fontSize: 41, lineHeight: 47, marginTop: 12 },
  subtitle: { color: '#C8D7CE', fontSize: 17, lineHeight: 25, marginTop: 14, fontWeight: '600' },
  progress: { marginTop: 26, borderRadius: 28, borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, backgroundColor: 'rgba(10,25,23,0.70)', padding: 21, gap: 11 },
  progressLabel: { color: ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  numberActive: { backgroundColor: ACCENT },
  numberText: { color: '#FAFFFB', fontSize: 12, fontWeight: '900' },
  progressText: { flex: 1, color: '#E7EEE9', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  card: { marginTop: 19, borderRadius: 30, padding: 22, backgroundColor: 'rgba(250,254,245,0.97)' },
  cardEyebrow: { color: '#1E775B', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  cardTitle: { color: '#0B261D', marginTop: 9, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  cardDescription: { color: '#537065', marginTop: 9, lineHeight: 22, fontSize: 14, fontWeight: '600' },
  primary: { marginTop: 19, minHeight: 58, backgroundColor: ACCENT, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: '#0D231B', fontWeight: '900', fontSize: 16 },
  outline: { marginTop: 10, minHeight: 54, borderRadius: 18, borderColor: 'rgba(17,55,42,0.22)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: '#163E32', fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.43 },
  warn: { color: '#8A381E', marginTop: 12, lineHeight: 19, fontSize: 13, fontWeight: '700' },
  trust: { color: '#506D60', fontSize: 12, marginTop: 18, lineHeight: 19 },
  roleNote: { color: '#7E481C', fontSize: 12, lineHeight: 19, marginTop: 12, fontWeight: '800' },
  secondary: { marginTop: 17, padding: 16, minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.27)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#F8F3E8', fontWeight: '900', fontSize: 15 },
  legal: { marginTop: 22, alignItems: 'center' },
  legalText: { color: '#AFC9BD', fontSize: 12, fontWeight: '700' },
  footnote: { marginTop: 15, color: '#95A79E', fontSize: 11, lineHeight: 18, textAlign: 'center' },
});
