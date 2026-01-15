import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMissionById } from '../../demoData';

export default function MissionScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const missionId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const mission = missionId ? getMissionById(missionId) : undefined;
  const [stage, setStage] = useState<'pending' | 'ongoing' | 'completed'>('pending');

  if (!mission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 12 }}>
          Mission introuvable (démo)
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#eab308' }}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleAction = () => {
    if (stage === 'pending') {
      setStage('ongoing');
    } else if (stage === 'ongoing') {
      setStage('completed');
      Alert.alert(
        'Mission (démo)',
        'Livraison confirmée.\n\nDans la version finale, la preuve photo et la signature client seraient envoyées ici.',
      );
    } else {
      router.back();
    }
  };

  const getButtonLabel = () => {
    if (stage === 'pending') return 'Démarrer la mission (démo)';
    if (stage === 'ongoing') return 'Confirmer la livraison (démo)';
    return 'Retour à la liste';
  };

  const getStageLabel = () => {
    if (stage === 'pending') return 'En attente de démarrage';
    if (stage === 'ongoing') return 'Mission en cours';
    return 'Mission terminée (démo)';
  };

  const getStageColor = () => {
    if (stage === 'pending') return '#f59e0b';
    if (stage === 'ongoing') return '#22c55e';
    return '#38bdf8';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#020617' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
        <Text style={{ color: '#9ca3af' }}>← Retour aux missions</Text>
      </Pressable>

      <Text style={{ color: '#facc15', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
        {mission.restaurantName}
      </Text>
      <Text style={{ color: '#9ca3af', marginBottom: 16 }}>
        Mission #{mission.id} · {mission.distance} · {mission.eta}
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
        <Text style={{ color: '#9ca3af', marginBottom: 6 }}>Étapes de la mission</Text>
        <Text style={{ color: 'white', marginBottom: 4 }}>1. Aller au restaurant</Text>
        <Text style={{ color: 'white', marginBottom: 4 }}>2. Récupérer la commande</Text>
        <Text style={{ color: 'white', marginBottom: 4 }}>3. Livrer le client</Text>
        <Text style={{ color: 'white' }}>4. Confirmer la livraison dans l&apos;app</Text>
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
        <Text style={{ color: '#9ca3af', marginBottom: 4 }}>Pickup</Text>
        <Text style={{ color: 'white', marginBottom: 8 }}>{mission.pickupAddress}</Text>
        <Text style={{ color: '#9ca3af', marginBottom: 4 }}>Livraison</Text>
        <Text style={{ color: 'white', marginBottom: 8 }}>{mission.dropoffAddress}</Text>
        <Text style={{ color: '#9ca3af' }}>
          Rémunération : <Text style={{ color: '#facc15', fontWeight: '700' }}>{mission.price}</Text>
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
        <Text style={{ color: '#9ca3af', marginBottom: 4 }}>Statut (démo)</Text>
        <Text style={{ color: getStageColor(), fontWeight: '700' }}>{getStageLabel()}</Text>
      </View>

      <Pressable
        onPress={handleAction}
        style={{
          backgroundColor: '#facc15',
          borderRadius: 999,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#020617', fontWeight: '700' }}>{getButtonLabel()}</Text>
      </Pressable>
    </ScrollView>
  );
}
