import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function OidcLogoutRecoveryScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.kicker}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Déconnexion terminée</Text>
        <Text style={styles.body}>
          Le retour fournisseur est terminé. La suppression locale des jetons reste inconditionnelle dans le moteur de session.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/auth-session')}>
          <Text style={styles.buttonText}>Retour à la session</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F', justifyContent: 'center', padding: 22 },
  card: { borderRadius: 28, padding: 24, backgroundColor: '#FFFFFF' },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#15803D' },
  title: { marginTop: 10, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  body: { marginTop: 12, fontSize: 15, lineHeight: 22, color: '#475569' },
  button: { marginTop: 22, minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
