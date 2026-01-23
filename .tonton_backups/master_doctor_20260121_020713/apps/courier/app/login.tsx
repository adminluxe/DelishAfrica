import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { setTokens } from '../utils/auth';
import { apiFetch } from '../utils/api';

export default function Login() {
 const router = useRouter();
 const [email, setEmail] = useState('driver@delish.africa');
 const [password, setPassword] = useState('demo1234');
 const [loading, setLoading] = useState(false);

 const handleLogin = async () => {
 setLoading(true);
 try {
 const r = await apiFetch('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
 if (!r.ok) throw new Error(`HTTP ${r.status}`);
 const data = await r.json();
 await setTokens(data?.accessToken || data?.token, data?.refreshToken);
 router.replace('/home');
 } catch (e:any) {
 await setTokens('dev-access','dev-refresh');
 Alert.alert('Mode ', 'Login backend indisponible — tokens appliqués.');
 router.replace('/home');
 } finally {
 setLoading(false);
 }
 };

 return (
 <SafeAreaView style={S.screen}>
 <Text style={S.title}>Connexion Coursier</Text>
 <View style={S.card}>
 <Text style={S.label}>Email</Text>
 <TextInput style={S.input} autoCapitalize="none" value={email} onChangeText={setEmail} keyboardType="email-address" />
 <Text style={S.label}>Mot de passe</Text>
 <TextInput style={S.input} value={password} onChangeText={setPassword} secureTextEntry />
 <Pressable onPress={handleLogin} style={S.btn} disabled={loading}>
 {loading ? <ActivityIndicator /> : <Text style={S.btnText}>Se connecter</Text>}
 </Pressable>
 </View>
 <Text style={S.hint}>En DEV, un token de démonstration est utilisé si l’API n’est pas prête.</Text>
 </SafeAreaView>
 );
}

const S = StyleSheet.create({
 screen: { flex: 1, backgroundColor: '#fff', padding: 16 },
 title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginVertical: 24 },
 card: { borderWidth: 1, borderColor: '#EEF2F6', borderRadius: 14, padding: 16, gap: 8 },
 label: { fontWeight: '600' },
 input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
 btn: { backgroundColor: '#00A36D', borderRadius: 10, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
 btnText: { color: '#fff', fontWeight: '700' },
 hint: { marginTop: 10, textAlign: 'center', color: '#6B7280' },
});
