import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const ACCOUNT_CONSOLE =
  'https://keycloak.afritaste.delishafrica.me/realms/afritaste/account/#/personal-info';

export default function AccountDeletion() {
  const router = useRouter();
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
            Le centre de compte sécurisé vous demandera de vous authentifier à nouveau. Dans « Informations personnelles »,
            choisissez « Supprimer le compte », puis confirmez. Cette action est irréversible.
          </Text>
          <Text style={styles.body}>
            Les données que la loi nous impose de conserver, notamment certaines pièces comptables ou éléments de lutte
            contre la fraude, suivent leurs délais légaux de conservation et ne servent plus à l’accès au compte.
          </Text>
          <Pressable
            testID="account-delete-open"
            accessibilityRole="button"
            style={styles.danger}
            onPress={() => void Linking.openURL(ACCOUNT_CONSOLE)}
          >
            <Text style={styles.dangerText}>Ouvrir la suppression sécurisée</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}>
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
  danger: { marginTop: 20, minHeight: 56, borderRadius: 16, backgroundColor: '#7F231C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  dangerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  back: { minHeight: 50, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#6C4A37', fontSize: 14, fontWeight: '800' },
});
