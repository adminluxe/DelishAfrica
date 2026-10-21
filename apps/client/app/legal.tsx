import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const LEGAL_BASE = 'https://api.delishafrica.me/api/v1/legal';
const ITEMS = [
  { title: 'Politique de confidentialité', subtitle: 'Données, sécurité et droits', url: `${LEGAL_BASE}/privacy` },
  { title: 'Conditions d’utilisation', subtitle: 'Règles du service DelishAfrica', url: `${LEGAL_BASE}/terms` },
  { title: 'Assistance', subtitle: 'Nous contacter', url: `${LEGAL_BASE}/support` },
];

export default function DelishAfricaLegalCenter() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>DELISHAFRICA®</Text>
        <Text style={styles.title}>Confidentialité & aide</Text>
        <Text style={styles.subtitle}>Vos droits, nos engagements et les informations utiles avant de continuer.</Text>
        <View style={styles.list}>
          {ITEMS.map((item) => (
            <Pressable key={item.url} style={styles.card} onPress={() => void Linking.openURL(item.url)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.link}>Ouvrir la page officielle →</Text>
            </Pressable>
          ))}
          <Pressable testID="account-delete-entry" style={[styles.card, styles.deleteCard]} onPress={() => router.push('/account-deletion' as any)}>
            <Text style={styles.cardTitle}>Supprimer mon compte</Text>
            <Text style={styles.cardSubtitle}>Initier la suppression définitive depuis DelishAfrica®</Text>
            <Text style={styles.deleteLink}>Continuer vers la suppression sécurisée →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9F2' },
  content: { padding: 24, paddingBottom: 48 },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.6, color: '#8B4A24' },
  title: { marginTop: 10, fontSize: 30, lineHeight: 35, fontWeight: '900', color: '#17110D' },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: '#6C5A4E' },
  list: { marginTop: 24, gap: 12 },
  card: { padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAD9C8' },
  deleteCard: { borderColor: '#D9A49F' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#24180F' },
  cardSubtitle: { marginTop: 5, fontSize: 14, color: '#75675D' },
  link: { marginTop: 12, fontSize: 13, fontWeight: '800', color: '#8B4A24' },
  deleteLink: { marginTop: 12, fontSize: 13, fontWeight: '900', color: '#7F231C' },
});
