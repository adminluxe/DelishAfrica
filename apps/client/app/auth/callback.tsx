import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from 'expo-router';

export default function OidcCallbackRecoveryScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.kicker}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Connexion sécurisée reçue</Text>
        <Text style={styles.body}>
          La connexion a bien été reçue. DelishAfrica finalise votre session et vous ramène dans l’application.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/secure-session')}>
          <Text style={styles.buttonText}>Continuer dans DelishAfrica</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F', justifyContent: 'center', padding: 22 },
  card: { borderRadius: 28, padding: 24, backgroundColor: '#FFFFFF' },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#2563EB' },
  title: { marginTop: 10, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  body: { marginTop: 12, fontSize: 15, lineHeight: 22, color: '#475569' },
  button: { marginTop: 22, minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
