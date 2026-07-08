import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MapPreview from './MapPreview';
import { Link } from 'expo-router';

type Props = {
  id: string;
  title?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  distanceKm?: number;
  reward?: number;
  pickup?: { lat: number; lng: number } | null;
  dropoff?: { lat: number; lng: number } | null;
  onAccept: (id: string) => void;
  onDelivered: (id: string) => void;
};

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">
    <rect width="240" height="160" fill="#f3f4f6"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
     font-family="sans-serif" font-size="16" fill="#6b7280">Colis • Photo</text>
  </svg>`);

export default function JobCard({
  id, title, pickupAddress, dropoffAddress, distanceKm, reward, pickup, dropoff, onAccept, onDelivered,
}: Props) {
  return (
    <View style={s.card}>
      <Link href={`/job/${id}`} asChild>
        <Pressable style={{ marginBottom: 8 }}>
          <Text style={s.cardTitle}>{title || `Mission ${id}`}</Text>
          <Image source={{ uri: PLACEHOLDER }} style={s.photo} />
          <View style={s.mapBox}>
            <MapPreview from={pickupAddress || "Pickup"} to={dropoffAddress || "Dropoff"} distance={distanceKm != null ? ` km` : undefined} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={s.cardLine}>📍 Pickup : {pickupAddress || '—'}</Text>
            <Text style={s.cardLine}>🏁 Dropoff : {dropoffAddress || '—'}</Text>
            <Text style={s.cardLine}>🚲 {distanceKm ?? '—'} km · 💶 {reward ?? '—'} €</Text>
            <Text style={{ color:'#1e40af', marginTop:6 }}>→ Voir la mission</Text>
          </View>
        </Pressable>
      </Link>
      <View style={s.row}>
        <Pressable onPress={() => onAccept(id)} style={[s.btn, s.btnPrimary]}>
          <Text style={s.btnTxt}>Accepter</Text>
        </Pressable>
        <Pressable onPress={() => onDelivered(id)} style={[s.btn, s.btnGhost]}>
          <Text style={s.btnTxt}>Livré 🎉</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 16, padding: 14, marginVertical: 10, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardLine: { color: '#374151', marginTop: 2 },
  photo: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#f3f4f6' },
  mapBox: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  btnPrimary: { backgroundColor: '#1e40af' },
  btnGhost: { backgroundColor: '#0f766e' },
  btnTxt: { color: 'white', fontWeight: '700' },
});
