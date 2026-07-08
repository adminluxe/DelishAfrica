import React, { useMemo, useState } from "react";
import {
Alert,
KeyboardAvoidingView,
Platform,
Pressable,
SafeAreaView,
ScrollView,
StyleSheet,
Switch,
Text,
TextInput,
View,
} from "react-native";
import { router } from "expo-router";

type CourierProfileLite = {
id: string;
riderName: string;
phone: string;
email: string;
activeZone: string;
vehicle: string;
capacity: string;
emergencyContact: string;
notes: string;
available: boolean;
updatedAt: string;
};

const PROFILE_KEY = "__DELISHAFRICA_COURIER_PROFILE_LITE_V1__";

function bag(): Record<string, unknown> {
return globalThis as unknown as Record<string, unknown>;
}

function readProfile(): CourierProfileLite | null {
const value = bag()[PROFILE_KEY];
if (!value || typeof value !== "object") return null;
return value as CourierProfileLite;
}

function writeProfile(profile: CourierProfileLite): void {
bag()[PROFILE_KEY] = profile;
}

function clean(value: string): string {
return String(value || "").trim();
}

function isValidEmail(value: string): boolean {
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function isComplete(profile: CourierProfileLite): boolean {
return Boolean(
clean(profile.riderName) &&
clean(profile.phone) &&
isValidEmail(profile.email) &&
clean(profile.activeZone) &&
clean(profile.vehicle)
);
}

export default function CourierSpaceScreen() {
const existing = readProfile();

const [riderName, setRiderName] = useState(existing?.riderName || "Coursier DelishAfrica");
const [phone, setPhone] = useState(existing?.phone || "+32 400 00 00 00");
const [email, setEmail] = useState(existing?.email || "coursier@exemple.com");
const [activeZone, setActiveZone] = useState(existing?.activeZone || "Bruxelles");
const [vehicle, setVehicle] = useState(existing?.vehicle || "Scooter");
const [capacity, setCapacity] = useState(existing?.capacity || "Missions actives");
const [emergencyContact, setEmergencyContact] = useState(
existing?.emergencyContact || "Ops DelishAfrica"
);
const [notes, setNotes] = useState(
existing?.notes || "Disponible pour les missions partenaires."
);
const [available, setAvailable] = useState(existing?.available ?? true);
const [saved, setSaved] = useState(Boolean(existing));

const preview = useMemo<CourierProfileLite>(() => {
return {
id: existing?.id || `da_courier_${Date.now().toString(36)}`,
riderName,
phone,
email,
activeZone,
vehicle,
capacity,
emergencyContact,
notes,
available,
updatedAt: new Date().toISOString(),
};
}, [
activeZone,
available,
capacity,
email,
emergencyContact,
existing?.id,
notes,
phone,
riderName,
vehicle,
]);

function save() {
const profile: CourierProfileLite = {
...preview,
riderName: clean(riderName),
phone: clean(phone),
email: clean(email).toLowerCase(),
activeZone: clean(activeZone),
vehicle: clean(vehicle),
capacity: clean(capacity),
emergencyContact: clean(emergencyContact),
notes: clean(notes),
available,
updatedAt: new Date().toISOString(),
};

if (!clean(profile.riderName)) {
Alert.alert("Profil incomplet", "Ajoute le nom du coursier.");
return;
}

if (!clean(profile.phone)) {
Alert.alert("Profil incomplet", "Ajoute un téléphone joignable.");
return;
}

if (!isValidEmail(profile.email)) {
Alert.alert("Email à corriger", "Ajoute un email valide.");
return;
}

if (!clean(profile.activeZone)) {
Alert.alert("Zone requise", "Ajoute une zone active.");
return;
}

if (!clean(profile.vehicle)) {
Alert.alert("Véhicule requis", "Ajoute vélo, scooter, voiture...");
return;
}

writeProfile(profile);
setSaved(true);

Alert.alert(
"Profil coursier prêt",
"Le profil terrain est prêt pour enrichir les missions.",
[{ text: "Retour terrain", onPress: () => router.replace("/") }]
);
}

return (
<SafeAreaView style={styles.safe}>
<KeyboardAvoidingView
style={styles.flex}
behavior={Platform.OS === "ios" ? "padding" : undefined}
>
<ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
<View style={styles.header}>
<Text style={styles.brand}>DELISHAFRICA · COURIER</Text>
<Text style={styles.title}>Profil coursier</Text>
<Text style={styles.subtitle}>
Identité terrain, disponibilité, zone active, véhicule et contact opérationnel.
</Text>
</View>

<View style={styles.statusCard}>
<Text style={styles.statusKicker}>TERRAIN ACTIF</Text>
<Text style={styles.statusTitle}>
{isComplete(preview) ? "Coursier prêt aux missions." : "Profil coursier à compléter."}
</Text>
<Text style={styles.statusText}>
Ce profil Lite prépare l’assignation, le suivi terrain et la supervision Ops.
</Text>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Identité</Text>

<Text style={styles.label}>Nom coursier *</Text>
<TextInput
value={riderName}
onChangeText={setRiderName}
placeholder="Nom coursier"
placeholderTextColor="#6C9078"
style={styles.input}
/>

<Text style={styles.label}>Téléphone *</Text>
<TextInput
value={phone}
onChangeText={setPhone}
placeholder="+32 ..."
placeholderTextColor="#6C9078"
style={styles.input}
keyboardType="phone-pad"
/>

<Text style={styles.label}>Email *</Text>
<TextInput
value={email}
onChangeText={setEmail}
placeholder="coursier@exemple.com"
placeholderTextColor="#6C9078"
style={styles.input}
keyboardType="email-address"
autoCapitalize="none"
autoCorrect={false}
/>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Terrain</Text>

<Text style={styles.label}>Zone active *</Text>
<TextInput
value={activeZone}
onChangeText={setActiveZone}
placeholder="Bruxelles"
placeholderTextColor="#6C9078"
style={styles.input}
/>

<Text style={styles.label}>Véhicule *</Text>
<TextInput
value={vehicle}
onChangeText={setVehicle}
placeholder="Vélo / Scooter / Voiture"
placeholderTextColor="#6C9078"
style={styles.input}
/>

<Text style={styles.label}>Capacité</Text>
<TextInput
value={capacity}
onChangeText={setCapacity}
placeholder="Missions actives"
placeholderTextColor="#6C9078"
style={styles.input}
/>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Ops & sécurité</Text>

<Text style={styles.label}>Contact urgence</Text>
<TextInput
value={emergencyContact}
onChangeText={setEmergencyContact}
placeholder="Ops / dispatch"
placeholderTextColor="#6C9078"
style={styles.input}
/>

<Text style={styles.label}>Note interne</Text>
<TextInput
value={notes}
onChangeText={setNotes}
placeholder="Infos utiles"
placeholderTextColor="#6C9078"
style={[styles.input, styles.multiline]}
multiline
/>
</View>

<View style={styles.toggleCard}>
<View style={styles.toggleTextWrap}>
<Text style={styles.toggleTitle}>Disponible</Text>
<Text style={styles.toggleText}>
Le coursier peut recevoir ou suivre les missions prêtes.
</Text>
</View>
<Switch value={available} onValueChange={setAvailable} />
</View>

<Pressable style={styles.primaryButton} onPress={save}>
<Text style={styles.primaryButtonText}>
{saved ? "Mettre à jour le profil" : "Enregistrer le profil"}
</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/orders" as any)}>
<Text style={styles.secondaryButtonText}>Voir les missions</Text>
</Pressable>

<Pressable style={styles.backButton} onPress={() => router.replace("/")}>
<Text style={styles.backText}>Retour terrain</Text>
</Pressable>

<Text style={styles.note}>
Profil coursier prêt. Ces informations aideront à fluidifier les missions et le suivi terrain.
</Text>
</ScrollView>
</KeyboardAvoidingView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
flex: { flex: 1 },
safe: { flex: 1, backgroundColor: "#00160D" },
page: { padding: 22, paddingBottom: 70 },
header: { marginBottom: 22 },
brand: {
color: "#9CF7B8",
fontSize: 20,
fontWeight: "900",
letterSpacing: 7,
marginBottom: 10,
},
title: {
color: "#F4FFF7",
fontSize: 38,
lineHeight: 44,
fontWeight: "900",
},
subtitle: {
color: "#BBD4C4",
fontSize: 17,
lineHeight: 26,
marginTop: 12,
fontWeight: "600",
},
statusCard: {
backgroundColor: "#EFFFF4",
borderRadius: 28,
padding: 22,
marginBottom: 18,
},
statusKicker: {
color: "#1E7A46",
fontSize: 14,
fontWeight: "900",
letterSpacing: 5,
marginBottom: 8,
},
statusTitle: {
color: "#00160D",
fontSize: 27,
lineHeight: 33,
fontWeight: "900",
marginBottom: 10,
},
statusText: {
color: "#53685B",
fontSize: 16,
lineHeight: 24,
fontWeight: "700",
},
card: {
backgroundColor: "#082719",
borderColor: "rgba(156,247,184,0.20)",
borderWidth: 1,
borderRadius: 26,
padding: 18,
marginBottom: 18,
},
cardTitle: {
color: "#F4FFF7",
fontSize: 25,
fontWeight: "900",
marginBottom: 16,
},
label: {
color: "#9CF7B8",
fontSize: 14,
fontWeight: "900",
letterSpacing: 3,
marginBottom: 8,
textTransform: "uppercase",
},
input: {
backgroundColor: "#001B10",
borderColor: "rgba(156,247,184,0.22)",
borderWidth: 1,
borderRadius: 18,
color: "#F4FFF7",
fontSize: 18,
fontWeight: "700",
paddingHorizontal: 16,
paddingVertical: 15,
marginBottom: 16,
},
multiline: {
minHeight: 74,
textAlignVertical: "top",
},
toggleCard: {
backgroundColor: "#062216",
borderColor: "rgba(156,247,184,0.22)",
borderWidth: 1,
borderRadius: 24,
padding: 18,
marginBottom: 18,
flexDirection: "row",
gap: 14,
alignItems: "center",
},
toggleTextWrap: { flex: 1 },
toggleTitle: {
color: "#F4FFF7",
fontSize: 19,
fontWeight: "900",
marginBottom: 6,
},
toggleText: {
color: "#BBD4C4",
fontSize: 15,
lineHeight: 22,
fontWeight: "600",
},
primaryButton: {
backgroundColor: "#16B765",
borderRadius: 22,
paddingVertical: 19,
paddingHorizontal: 22,
alignItems: "center",
marginTop: 4,
marginBottom: 14,
},
primaryButtonText: {
color: "#00160D",
fontSize: 19,
fontWeight: "900",
textAlign: "center",
},
secondaryButton: {
backgroundColor: "#082719",
borderColor: "rgba(255,255,255,0.14)",
borderWidth: 1,
borderRadius: 22,
paddingVertical: 18,
paddingHorizontal: 22,
alignItems: "center",
marginBottom: 14,
},
secondaryButtonText: {
color: "#F4FFF7",
fontSize: 18,
fontWeight: "900",
textAlign: "center",
},
backButton: {
paddingVertical: 20,
alignItems: "center",
},
backText: {
color: "#9CF7B8",
fontSize: 18,
fontWeight: "900",
},
note: {
color: "#7E9789",
fontSize: 13,
lineHeight: 20,
textAlign: "center",
marginTop: 8,
fontWeight: "600",
},
});
