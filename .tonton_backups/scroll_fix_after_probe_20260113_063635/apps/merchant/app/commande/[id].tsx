import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrderById } from '../../demoData';

export default function OrderScreen() {
 const { id } = useLocalSearchParams();
 const router = useRouter();
 const orderId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
 const order = orderId ? getOrderById(orderId) : undefined;
 const [status, setStatus] = useState<'received' | 'preparing' | 'ready'>(
 'received'
 );

 if (!order) {
 return (
 <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
 <Text style={{ color: 'white', fontSize: 18, marginBottom: 12 }}>
 Commande introuvable 
 </Text>
 <Pressable onPress={() => router.back()}>
 <Text style={{ color: '#eab308' }}>← Retour</Text>
 </Pressable>
 </View>
 );
 }

 const advanceStatus = () => {
 if (status === 'received') {
 setStatus('preparing');
 } else if (status === 'preparing') {
 setStatus('ready');
 Alert.alert(
 'Commande prête ',
 "Dans la version finale, le coursier serait notifié que la commande est prête à être récupérée."
 );
 } else {
 router.back();
 }
 };

 const getStatusLabel = () => {
 if (status === 'received') return 'Commande reçue';
 if (status === 'preparing') return 'En préparation';
 return 'Prête pour le coursier ';
 };

 const getStatusColor = () => {
 if (status === 'received') return '#f59e0b';
 if (status === 'preparing') return '#22c55e';
 return '#38bdf8';
 };

 const getButtonLabel = () => {
 if (status === 'received') return 'Commencer la préparation ';
 if (status === 'preparing') return 'Marquer comme prête ';
 return 'Retour à la liste';
 };

 return (
 <ScrollView
 style={{ flex: 1, backgroundColor: '#020617' }}
 contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
 >
 <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
 <Text style={{ color: '#9ca3af' }}>← Retour aux commandes</Text>
 </Pressable>

 <Text style={{ color: '#facc15', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
 Commande {order.id}
 </Text>
 <Text style={{ color: '#9ca3af', marginBottom: 12 }}>
 Client : {order.customerName}
 </Text>
 <Text style={{ color: '#9ca3af', marginBottom: 16 }}>
 Livraison : {order.address}
 </Text>

 <View
 style={{
 backgroundColor: '#020617',
 borderRadius: 16,
 padding: 16,
 borderWidth: 1,
 borderColor: '#111827',
 marginBottom: 16,
 }}
 >
 <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Contenu de la commande</Text>
 {order.items.map((item, index) => (
 <Text key={index} style={{ color: 'white', marginBottom: 4 }}>
 • {item.quantity} × {item.name}
 </Text>
 ))}
 <Text
 style={{
 color: '#9ca3af',
 marginTop: 8,
 }}
 >
 Total : <Text style={{ color: '#facc15', fontWeight: '700' }}>{order.total}</Text>
 </Text>
 </View>

 <View
 style={{
 backgroundColor: '#020617',
 borderRadius: 16,
 padding: 16,
 borderWidth: 1,
 borderColor: '#111827',
 marginBottom: 24,
 }}
 >
 <Text style={{ color: '#9ca3af', marginBottom: 4 }}>Statut </Text>
 <Text style={{ color: getStatusColor(), fontWeight: '700' }}>
 {getStatusLabel()}
 </Text>
 </View>

 <Pressable
 onPress={advanceStatus}
 style={{
 backgroundColor: '#facc15',
 borderRadius: 999,
 paddingVertical: 14,
 alignItems: 'center',
 }}
 >
 <Text style={{ color: '#020617', fontWeight: '700' }}>
 {getButtonLabel()}
 </Text>
 </Pressable>
 </ScrollView>
 );
}
