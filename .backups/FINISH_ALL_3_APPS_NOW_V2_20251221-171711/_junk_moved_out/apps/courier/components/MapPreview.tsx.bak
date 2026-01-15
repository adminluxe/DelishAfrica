import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, LatLng, Region } from 'react-native-maps';

type Props = {
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
};

export default function MapPreview({ pickup, dropoff }: Props) {
  const center: LatLng = pickup
    ? { latitude: pickup.lat, longitude: pickup.lng }
    : { latitude: 50.8467, longitude: 4.3525 }; // Bruxelles fallback

  const region: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.wrap}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region} pointerEvents="none">
        {pickup && (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            title="Pickup"
            pinColor="#1e40af"
          />
        )}
        {dropoff && (
          <Marker
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
            title="Dropoff"
            pinColor="#10b981"
          />
        )}
      </MapView>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e5e7eb' },
});
