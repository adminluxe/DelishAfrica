import React from 'react';
import {
  ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet,
  Text, View, useWindowDimensions, type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type AccountAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  testID: string;
};
export type AccountEntryProps = {
  brand: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  background: string;
  image: ImageSourcePropType;
  connected: boolean;
  heading: string;
  description: string;
  primary: AccountAction;
  secondary?: AccountAction;
  explore?: AccountAction;
  status?: string;
  notice?: string;
  availability?: string;
  progress?: { current: number; steps: readonly string[] };
  onLegal: () => void;
};

// Presentation only. Authentication, authorization and dossier truth stay in their adapters.
export default function DaAccountEntry(props: AccountEntryProps) {
  const { width } = useWindowDimensions();
  const action = (value: AccountAction, primary: boolean) => (
    <Pressable
      testID={value.testID}
      accessibilityRole="button"
      accessibilityLabel={value.label}
      accessibilityState={{ disabled: Boolean(value.disabled || value.busy), busy: Boolean(value.busy) }}
      disabled={Boolean(value.disabled || value.busy)}
      onPress={value.onPress}
      style={({ pressed }) => [
        styles.action, primary ? { backgroundColor: props.accent } : styles.outline,
        (value.disabled || value.busy) && styles.disabled, pressed && styles.pressed,
      ]}
    >
      {value.busy ? <ActivityIndicator color={primary ? '#081B16' : '#FFF9EF'} /> : null}
      <Text style={[styles.actionText, !primary && styles.lightText]}>{value.busy ? 'Connexion en cours…' : value.label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: props.background }]}>
      <ImageBackground source={props.image} resizeMode="cover" style={styles.safe} imageStyle={styles.image}>
        <View style={styles.veil}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.page}>
              <Text style={[styles.brand, { color: props.accent }]}>{props.brand}</Text>
              <View style={[styles.brandRule, { backgroundColor: props.accent }]} />
              <Text style={styles.eyebrow}>{props.eyebrow}</Text>
              <Text accessibilityRole="header" style={[styles.title, width < 360 && styles.smallTitle]}>{props.title}</Text>
              <Text style={styles.subtitle}>{props.subtitle}</Text>
              <View style={styles.card}>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: props.connected ? props.accent : '#97A89F' }]} />
                  <Text style={[styles.statusLabel, { color: props.accent }]}>{props.connected ? 'COMPTE CONNECTÉ' : 'VOTRE COMPTE'}</Text>
                </View>
                <Text accessibilityRole="header" style={styles.heading}>{props.heading}</Text>
                <Text style={styles.description}>{props.description}</Text>
                {props.status ? <Text accessibilityLiveRegion="polite" style={styles.status}>{props.status}</Text> : null}
                {props.notice ? (
                  <View style={styles.noticeBox}>
                    <Text testID="auth-notice" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{props.notice}</Text>
                  </View>
                ) : null}
                {action(props.primary, true)}
                {props.secondary ? action(props.secondary, false) : null}
                {props.availability ? <Text style={styles.availability}>{props.availability}</Text> : null}
              </View>
              {props.progress ? (
                <View testID="account-progress" style={styles.progress}>
                  <Text style={styles.progressTitle}>VOTRE PARCOURS</Text>
                  {props.progress.steps.map((step, index) => {
                    const active = index === props.progress!.current;
                    const complete = index < props.progress!.current;
                    return (
                      <View key={step} style={styles.step} accessible accessibilityLabel={`${index + 1}. ${step}. ${complete ? 'Étape passée' : active ? 'Étape actuelle' : 'À venir'}`}>
                        <View style={[styles.number, active && { backgroundColor: props.accent }]}>
                          <Text style={[styles.numberText, active && styles.darkText]}>{complete ? '✓' : index + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, active && styles.lightText]}>{step}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {props.explore ? action(props.explore, false) : null}
              <Pressable testID="account-legal" onPress={props.onLegal} accessibilityRole="button" style={styles.legal}>
                <Text style={styles.legalText}>Confidentialité · Conditions · Assistance</Text>
              </Pressable>
              <Text style={styles.footnote}>Vos accès restent personnels. La connexion s’ouvre dans une fenêtre sécurisée.</Text>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  image: { opacity: 0.24 },
  veil: { flex: 1, backgroundColor: 'rgba(3,12,12,0.80)' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 },
  page: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  brand: { fontSize: 11, fontWeight: '900', letterSpacing: 1.65, lineHeight: 18 },
  brandRule: { width: 38, height: 3, borderRadius: 2, marginTop: 15 },
  eyebrow: { color: '#BCD0C4', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 25 },
  title: { color: '#FFF9EF', fontSize: 38, lineHeight: 43, fontWeight: '900', marginTop: 9, letterSpacing: -1 },
  smallTitle: { fontSize: 32, lineHeight: 38 },
  subtitle: { color: '#CDD9D1', fontSize: 15, lineHeight: 23, marginTop: 12 },
  card: { marginTop: 24, padding: 22, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(242,235,216,0.23)', backgroundColor: 'rgba(13,31,27,0.94)' },
  statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { flex: 1, fontSize: 10, fontWeight: '900', lineHeight: 16, letterSpacing: 1.4 },
  heading: { color: '#FFF9EF', fontSize: 23, lineHeight: 29, fontWeight: '800', marginTop: 12 },
  description: { color: '#C7D4CC', fontSize: 14, lineHeight: 21, marginTop: 8 },
  status: { color: '#E6EDDC', fontSize: 14, fontWeight: '700', lineHeight: 22, marginTop: 14 },
  action: { minHeight: 56, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, marginTop: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  actionText: { color: '#081B16', fontSize: 15, lineHeight: 22, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  outline: { borderWidth: 1, borderColor: 'rgba(222,238,226,0.32)', backgroundColor: 'rgba(12,29,25,0.54)' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  lightText: { color: '#FFF9EF' },
  darkText: { color: '#081B16' },
  availability: { color: '#D3DCCD', fontSize: 12, lineHeight: 19, marginTop: 16 },
  noticeBox: { borderLeftWidth: 3, borderLeftColor: '#F3BF91', paddingLeft: 12, marginTop: 14 },
  notice: { color: '#FFE1C7', fontSize: 13, lineHeight: 21 },
  progress: { marginTop: 24, marginBottom: 6, paddingHorizontal: 5, gap: 11 },
  progressTitle: { color: '#B5C7BA', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  number: { width: 25, height: 25, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#D5E1D9', fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, color: '#B5C7BC', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  legal: { minHeight: 48, marginTop: 15, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  legalText: { color: '#D0DCD3', fontSize: 12, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  footnote: { color: '#AABCAF', fontSize: 11, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
});
