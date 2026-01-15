import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRestaurantById } from '../../demoData';

export default function RestaurantScreen() {
 const { id } = useLocalSearchParams<{ id: string }>();
 const router = useRouter();
 const restaurant = id ? getRestaurantById(String(id)) : undefined;

 if (!restaurant) {
 return (
 <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
 <Text style={{ color: 'white', fontSize: 18, marginBottom: 12 }}>
 Restaurant introuvable 
 </Text>
 <Pressable onPress={() => router.back()}>
 <Text style={{ color: '#eab308' }}>← Retour</Text>
 </Pressable>
 </View>
 );
 }

 return (
 <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flex: 1, backgroundColor: '#020617' }} contentContainerStyle={{ padding: 20 }}>
 <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
 <Text style={{ color: '#9ca3af' }}>← Retour à la sélection</Text>
 </Pressable>

 <Text style={{ color: '#facc15', fontSize: 26, fontWeight: '700', marginBottom: 4 }}>
 {restaurant.name}
 </Text>
 <Text style={{ color: '#9ca3af', marginBottom: 12 }}>{restaurant.city}</Text>
 <Text style={{ color: 'white', marginBottom: 24 }}>{restaurant.description}</Text>

 <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
 Carte 
 </Text>

 {restaurant.dishes.map(dish => (
 <View
 key={dish.id}
 style={{
 backgroundColor: '#020617',
 borderRadius: 16,
 padding: 16,
 marginBottom: 12,
 borderWidth: 1,
 borderColor: '#111827',
 }}
 >
 <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
 {dish.name}
 </Text>
 <Text style={{ color: '#9ca3af', marginBottom: 6 }}>{dish.description}</Text>
 <Text style={{ color: '#facc15', fontWeight: '600' }}>{dish.price}</Text>
 </View>
 ))}

 <Pressable
 onPress={() =>
 Alert.alert(
 'Commande ',
 "Ici, le client choisirait ses plats, validerait l'adresse et le paiement.\n\nPour la , on montre le parcours sans finaliser le paiement."
 )
 }
 style={{
 marginTop: 20,
 backgroundColor: '#facc15',
 paddingVertical: 14,
 borderRadius: 999,
 alignItems: 'center',
 }}
 >
 <Text style={{ fontWeight: '700', color: '#020617' }}>Lancer une commande </Text>
 </Pressable>
 </ScrollView>
 );
}
