import React, { useState } from "react";
import {
 View,
 Text,
 ScrollView,
 Pressable,
 StyleSheet,
 Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { demoMissions } from "../-missions";

type MissionStep = "recu" | "en_route" | "photo" | "terminee";

export default function MissionDetail() {
 const { id } = useLocalSearchParams<{ id?: string }>();
 const router = useRouter();

 const missions = demoMissions || [];
 const mission = missions.find((m) => m.id === id) || missions[0];

 const [step, setStep] = useState<MissionStep>("recu");

 if (!mission) {
 return (
 <View style={styles.center}>
 <Text style={styles.title}>Mission introuvable</Text>
 <Pressable style={styles.primaryButton} onPress={() => router.back()}>
 <Text style={styles.primaryButtonText}>Retour</Text>
 </Pressable>
 </View>
 );
 }

 const handleAccept = () => {
 setStep("en_route");
 };

 const handleStart = () => {
 setStep("photo");
 };

 const handleConfirm = () => {
 setStep("terminee");
 Alert.alert(
 "Mission terminée",
 "La mission a été marquée comme livrée ."
 );
 };

 return (
 <ScrollView contentContainerStyle={styles.container}>
 <Text style={styles.badge}>Mission </Text>
 <Text style={styles.title}>{mission.title}</Text>

 <View style={styles.card}>
 <Text style={styles.label}>Restaurant</Text>
 <Text style={styles.value}>{mission.restaurantName}</Text>

 <Text style={styles.label}>Adresse de prise en charge</Text>
 <Text style={styles.value}>{mission.pickupAddress}</Text>

 <Text style={styles.label}>Adresse de livraison</Text>
 <Text style={styles.value}>{mission.dropoffAddress}</Text>

 <Text style={styles.label}>Montant</Text>
 <Text style={styles.value}>{mission.amount}</Text>

 <Text style={styles.label}>Distance / ETA</Text>
 <Text style={styles.value}>
 {mission.distanceKm} km · {mission.etaMin} min
 </Text>
 </View>

 <View style={styles.stepCard}>
 <Text style={styles.stepTitle}>Progression</Text>
 <Text style={styles.stepText}>
 {step === "recu" && "Étape 1/3 – Mission reçue."}
 {step === "en_route" && "Étape 2/3 – En route vers le client."}
 {step === "photo" && "Étape 3/3 – Photo de confirmation ."}
 {step === "terminee" && "Mission terminée ✔️ ."}
 </Text>
 </View>

 {step === "recu" && (
 <Pressable style={styles.primaryButton} onPress={handleAccept}>
 <Text style={styles.primaryButtonText}>Accepter la mission</Text>
 </Pressable>
 )}

 {step === "en_route" && (
 <Pressable style={styles.primaryButton} onPress={handleStart}>
 <Text style={styles.primaryButtonText}>Démarrer la mission</Text>
 </Pressable>
 )}

 {step === "photo" && (
 <Pressable style={styles.primaryButton} onPress={handleConfirm}>
 <Text style={styles.primaryButtonText}>
 Confirmer la livraison 
 </Text>
 </Pressable>
 )}

 {step === "terminee" && (
 <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
 <Text style={styles.secondaryButtonText}>Retour aux missions</Text>
 </Pressable>
 )}

 {step !== "terminee" && (
 <Pressable
 style={styles.secondaryButton}
 onPress={() => router.back()}
 >
 <Text style={styles.secondaryButtonText}>Annuler / Retour</Text>
 </Pressable>
 )}
 </ScrollView>
 );
}

const styles = StyleSheet.create({
 container: {
 padding: 20,
 paddingBottom: 40,
 backgroundColor: "#020617",
 flexGrow: 1,
 },
 center: {
 flex: 1,
 backgroundColor: "#020617",
 alignItems: "center",
 justifyContent: "center",
 padding: 20,
 },
 badge: {
 alignSelf: "flex-start",
 paddingHorizontal: 10,
 paddingVertical: 4,
 borderRadius: 999,
 backgroundColor: "#22c55e33",
 color: "#22c55e",
 fontSize: 12,
 marginBottom: 8,
 },
 title: {
 fontSize: 22,
 fontWeight: "700",
 color: "#e5e7eb",
 marginBottom: 16,
 },
 card: {
 backgroundColor: "#0b1220",
 borderRadius: 16,
 padding: 16,
 marginBottom: 16,
 borderWidth: 1,
 borderColor: "#1f2937",
 },
 label: {
 fontSize: 12,
 textTransform: "uppercase",
 color: "#6b7280",
 marginTop: 8,
 },
 value: {
 fontSize: 14,
 color: "#e5e7eb",
 marginTop: 2,
 },
 stepCard: {
 backgroundColor: "#020617",
 borderRadius: 12,
 padding: 14,
 borderWidth: 1,
 borderColor: "#1d4ed8",
 marginBottom: 20,
 },
 stepTitle: {
 fontSize: 14,
 fontWeight: "600",
 color: "#bfdbfe",
 marginBottom: 4,
 },
 stepText: {
 fontSize: 13,
 color: "#e5e7eb",
 },
 primaryButton: {
 backgroundColor: "#facc15",
 borderRadius: 999,
 paddingVertical: 12,
 paddingHorizontal: 20,
 alignItems: "center",
 marginBottom: 12,
 },
 primaryButtonText: {
 color: "#111827",
 fontWeight: "700",
 },
 secondaryButton: {
 borderRadius: 999,
 paddingVertical: 10,
 paddingHorizontal: 20,
 alignItems: "center",
 borderWidth: 1,
 borderColor: "#4b5563",
 marginBottom: 10,
 },
 secondaryButtonText: {
 color: "#9ca3af",
 fontWeight: "500",
 },
});
