import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

// Compatibility route: canonical catalogue at /restaurants.
export default function LegacyExploreRedirect() {
  useEffect(() => { router.replace('/restaurants' as any); }, []);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <ActivityIndicator color="#E7B85F" />
        <Text style={styles.text}>Ouverture des restaurants…</Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#04150E' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  text: { color: '#FFF8EA', fontSize: 16, fontWeight: '700' },
});
