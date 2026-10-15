import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

// Recovery UI only. Authorization codes and tokens are handled exclusively by AuthSession.
export default function MerchantOidcRecovery() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.brand}>DELISHAFRICA® · RESTAURATEUR</Text>
        <Text style={styles.title}>Déconnexion terminée</Text>
        <Text style={styles.detail}>Votre accès a été fermé. Vous pouvez revenir à l'accueil et vous reconnecter.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/onboarding' as any)} style={styles.action}>
          <Text style={styles.actionText}>Retour à mon compte</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#1E100A' },
  card: { borderRadius: 28, backgroundColor: '#FFF9F0', padding: 25 },
  brand: { color: '#A05C20', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  title: { marginTop: 14, color: '#2B180E', fontWeight: '900', fontSize: 29, lineHeight: 36 },
  detail: { marginTop: 14, color: '#6B584A', fontSize: 16, lineHeight: 24 },
  action: { marginTop: 24, minHeight: 57, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5B477' },
  actionText: { color: '#2B180E', fontSize: 16, fontWeight: '900' },
});
