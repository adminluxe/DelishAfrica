// apps/courier/app/debug.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

type Health = { ok: boolean } | Record<string, any>;
type JobsResp = { items?: Array<{ id: string; status?: string }> };

async function jfetch<T = any>(url: string, init?: RequestInit): Promise<T> {
 const r = await fetch(url, init);
 const data = await r.json().catch(() => ({}));
 if (!r.ok || (typeof (data as any)?.ok !== 'undefined' && (data as any).ok === false)) {
 const msg = (data as any)?.message || (data as any)?.status || `HTTP ${r.status}`;
 throw new Error(String(msg));
 }
 return data as T;
}

const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
 <Pressable onPress={onPress} style={{ padding: 10, borderWidth: 1, borderRadius: 8, marginRight: 8, marginVertical: 6 }}>
 <Text>{label}</Text>
 </Pressable>
);

export default function DebugPage() {
 const router = useRouter();

 const EXTRA = (Constants.expoConfig as any)?.extra || {};
 const API_RAW =
 process.env.EXPO_PUBLIC_API_BASE_URL ||
 EXTRA.API_BASE_URL ||
 'https://api.delishafrica.me';
 const API = useMemo(() => String(API_RAW).replace(/\/+$/, ''), [API_RAW]);

 const [health, setHealth] = useState<string>('(non testé)');
 const [myCount, setMyCount] = useState<number | null>(null);
 const [availCount, setAvailCount] = useState<number | null>(null);
 const [jobId, setJobId] = useState<string>('job_demo_0001');

 const pingHealth = async () => {
 try {
 const h = await jfetch<Health>(`${API}/api/health`);
 setHealth(JSON.stringify(h));
 } catch (e: any) {
 setHealth(`Erreur: ${e?.message}`);
 }
 };

 const loadMy = async () => {
 try {
 const r = await jfetch<JobsResp>(`${API}/api/couriers/my`);
 setMyCount((r.items ?? []).length);
 } catch {
 setMyCount(0);
 }
 };

 const loadAvail = async () => {
 try {
 const r = await jfetch<JobsResp>(`${API}/api/couriers/jobs/available`);
 setAvailCount((r.items ?? []).length);
 } catch {
 setAvailCount(0);
 }
 };

 const call = async (path: string, okMsg: string) => {
 try {
 await jfetch(`${API}${path}`, { method: 'POST' });
 Alert.alert('OK', okMsg);
 await Promise.all([loadMy(), loadAvail()]);
 } catch (e: any) {
 Alert.alert('Erreur', e?.message ?? 'Action KO');
 }
 };

 const resetDemo = async () => {
 try {
 await jfetch(`${API}/api/couriers/reset`, { method: 'POST' });
 await Promise.all([loadMy(), loadAvail()]);
 Alert.alert('OK', 'Reset effectué');
 } catch (e: any) {
 Alert.alert('Erreur', e?.message ?? 'Reset KO');
 }
 };

 useEffect(() => {
 pingHealth();
 loadMy();
 loadAvail();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 return (
 <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16 }}>
 <View style={{ marginBottom: 12 }}>
 <Btn label="← Retour" onPress={() => router.back()} />
 </View>

 <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>DEBUG</Text>

 <Text style={{ marginBottom: 6 }}>API détectée:</Text>
 <Text selectable style={{ fontFamily: 'monospace', marginBottom: 12 }}>{API}</Text>

 <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
 <Btn label="Ping /api/health" onPress={pingHealth} />
 <Btn label="Mes courses" onPress={loadMy} />
 <Btn label="Jobs disponibles" onPress={loadAvail} />
 <Btn label="Reset (dev)" onPress={resetDemo} />
 </View>

 <Text style={{ marginTop: 12 }}>Health: {health}</Text>
 <Text>My count: {myCount ?? '-'}</Text>
 <Text>Available count: {availCount ?? '-'}</Text>

 <View style={{ height: 1, backgroundColor: '#ddd', marginVertical: 16 }} />

 <Text style={{ fontWeight: '700', marginBottom: 6 }}>Actions rapides (ID de job)</Text>
 <TextInput
 placeholder="job_demo_0001"
 value={jobId}
 onChangeText={setJobId}
 style={{ borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }}
 autoCapitalize="none"
 />
 <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
 <Btn label="Accept" onPress={() => call(`/api/couriers/jobs/${jobId}/accept`, 'Accept OK')} />
 <Btn label="Assign" onPress={() => call(`/api/couriers/jobs/${jobId}/assign`, 'Assign OK')} />
 <Btn label="Pickup" onPress={() => call(`/api/couriers/jobs/${jobId}/pickup`, 'Pickup OK')} />
 <Btn label="Start" onPress={() => call(`/api/couriers/jobs/${jobId}/start`, 'Start OK')} />
 <Btn label="Delivered"onPress={() => call(`/api/couriers/jobs/${jobId}/delivered`,'Delivered OK')} />
 </View>

 <View style={{ height: 1, backgroundColor: '#ddd', marginVertical: 16 }} />

 <Text style={{ fontWeight: '700', marginBottom: 6 }}>ENV aperçus</Text>
 <Text selectable style={{ fontFamily: 'monospace' }}>
 EXPO_PUBLIC_API_BASE_URL = {String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '(unset)')}
 </Text>
 <Text selectable style={{ fontFamily: 'monospace' }}>
 expo.extra.API_BASE_URL = {String(EXTRA.API_BASE_URL ?? '(unset)')}
 </Text>
 </ScrollView>
 );
}
