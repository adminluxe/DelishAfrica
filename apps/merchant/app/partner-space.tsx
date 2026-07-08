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

type PartnerProfileLite = {
id: string;
restaurantName: string;
managerName: string;
phone: string;
email: string;
address: string;
city: string;
specialty: string;
prepTime: string;
pickupInstructions: string;
serviceOpen: boolean;
updatedAt: string;
};

const PROFILE_KEY = "__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__";

function bag(): Record<string, unknown> {
return globalThis as unknown as Record<string, unknown>;
}

function readProfile(): PartnerProfileLite | null {
const value = bag()[PROFILE_KEY];
if (!value || typeof value !== "object") return null;
return value as PartnerProfileLite;
}

function writeProfile(profile: PartnerProfileLite): void {
bag()[PROFILE_KEY] = profile;
}

function clean(value: string): string {
return String(value || "").trim();
}

function isValidEmail(value: string): boolean {
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function isComplete(profile: PartnerProfileLite): boolean {
return Boolean(
clean(profile.restaurantName) &&
clean(profile.managerName) &&
clean(profile.phone) &&
isValidEmail(profile.email) &&
clean(profile.address) &&
clean(profile.city) &&
clean(profile.prepTime)
);
}

export default function PartnerSpaceScreen() {
const existing = readProfile();

const [restaurantName, setRestaurantName] = useState(existing?.restaurantName || "Thieyp");
const [managerName, setManagerName] = useState(existing?.managerName || "Équipe Thieyp");
const [phone, setPhone] = useState(existing?.phone || "+32 493 39 27 37");
const [email, setEmail] = useState(existing?.email || "info@thieyp.be");
const [address, setAddress] = useState(existing?.address || "Rue Longue Vie 46, 1050 Ixelles");
const [city, setCity] = useState(existing?.city || "Bruxelles");
const [specialty, setSpecialty] = useState(
existing?.specialty || "Cuisine sénégalaise"
);
const [prepTime, setPrepTime] = useState(existing?.prepTime || "20 min");
const [pickupInstructions, setPickupInstructions] = useState(
existing?.pickupInstructions || "Retrait au comptoir Thieyp, Rue Longue Vie 46."
);
const [serviceOpen, setServiceOpen] = useState(existing?.serviceOpen ?? true);
const [saved, setSaved] = useState(Boolean(existing));

const preview = useMemo<PartnerProfileLite>(() => {
return {
id: existing?.id || `da_partner_${Date.now().toString(36)}`,
restaurantName,
managerName,
phone,
email,
address,
city,
specialty,
prepTime,
pickupInstructions,
serviceOpen,
updatedAt: new Date().toISOString(),
};
}, [
address,
city,
email,
existing?.id,
managerName,
phone,
pickupInstructions,
prepTime,
restaurantName,
serviceOpen,
specialty,
]);

function save() {
const profile: PartnerProfileLite = {
...preview,
restaurantName: clean(restaurantName),
managerName: clean(managerName),
phone: clean(phone),
email: clean(email).toLowerCase(),
address: clean(address),
city: clean(city),
specialty: clean(specialty),
prepTime: clean(prepTime),
pickupInstructions: clean(pickupInstructions),
serviceOpen,
updatedAt: new Date().toISOString(),
};

if (!clean(profile.restaurantName)) {
Alert.alert("Profil incomplet", "Ajoute le nom du restaurant.");
return;
}

if (!clean(profile.managerName)) {
Alert.alert("Profil incomplet", "Ajoute le nom du responsable.");
return;
}

if (!clean(profile.phone)) {
Alert.alert("Profil incomplet", "Ajoute un téléphone restaurant.");
return;
}

if (!isValidEmail(profile.email)) {
Alert.alert("Email à corriger", "Ajoute un email valide.");
return;
}

if (!clean(profile.address) || !clean(profile.city)) {
Alert.alert("Adresse incomplète", "Ajoute adresse et ville.");
return;
}

if (!clean(profile.prepTime)) {
Alert.alert("Temps préparation requis", "Ajoute une estimation, exemple : 20 min.");
return;
}

writeProfile(profile);
setSaved(true);

Alert.alert(
"Espace partenaire prêt",
"Le profil restaurant est prêt pour améliorer le service cuisine.",
[{ text: "Retour cockpit", onPress: () => router.replace("/") }]
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
<Text style={styles.brand}>DELISHAFRICA · MERCHANT</Text>
<Text style={styles.title}>Espace partenaire</Text>
<Text style={styles.subtitle}>
Profil restaurant, contact cuisine, temps de préparation et consignes de retrait.
</Text>
</View>

<View style={styles.statusCard}>
<Text style={styles.statusKicker}>PARTENAIRE ACTIF</Text>
<Text style={styles.statusTitle}>
{isComplete(preview) ? "Restaurant prêt au service." : "Profil restaurant à compléter."}
</Text>
<Text style={styles.statusText}>
Ces informations aident DelishAfrica à préparer des commandes plus justes, un retrait plus clair et une meilleure qualité de service.
</Text>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Restaurant</Text>

<Text style={styles.label}>Nom restaurant *</Text>
<TextInput
value={restaurantName}
onChangeText={setRestaurantName}
placeholder="Thieyp"
placeholderTextColor="#8C7567"
style={styles.input}
/>

<Text style={styles.label}>Spécialité</Text>
<TextInput
value={specialty}
onChangeText={setSpecialty}
placeholder="Cuisine sénégalaise"
placeholderTextColor="#8C7567"
style={styles.input}
/>

<Text style={styles.label}>Responsable *</Text>
<TextInput
value={managerName}
onChangeText={setManagerName}
placeholder="Équipe Thieyp"
placeholderTextColor="#8C7567"
style={styles.input}
/>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Contact</Text>

<Text style={styles.label}>Téléphone cuisine *</Text>
<TextInput
value={phone}
onChangeText={setPhone}
placeholder="+32 ..."
placeholderTextColor="#8C7567"
style={styles.input}
keyboardType="phone-pad"
/>

<Text style={styles.label}>Email partenaire *</Text>
<TextInput
value={email}
onChangeText={setEmail}
placeholder="info@thieyp.be"
placeholderTextColor="#8C7567"
style={styles.input}
keyboardType="email-address"
autoCapitalize="none"
autoCorrect={false}
/>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Pickup</Text>

<Text style={styles.label}>Adresse *</Text>
<TextInput
value={address}
onChangeText={setAddress}
placeholder="Rue, numéro, quartier"
placeholderTextColor="#8C7567"
style={[styles.input, styles.multiline]}
multiline
/>

<Text style={styles.label}>Ville *</Text>
<TextInput
value={city}
onChangeText={setCity}
placeholder="Bruxelles"
placeholderTextColor="#8C7567"
style={styles.input}
/>

<Text style={styles.label}>Temps moyen préparation *</Text>
<TextInput
value={prepTime}
onChangeText={setPrepTime}
placeholder="20 min"
placeholderTextColor="#8C7567"
style={styles.input}
/>

<Text style={styles.label}>Consignes coursier</Text>
<TextInput
value={pickupInstructions}
onChangeText={setPickupInstructions}
placeholder="Où récupérer, qui appeler..."
placeholderTextColor="#8C7567"
style={[styles.input, styles.multiline]}
multiline
/>
</View>

<View style={styles.toggleCard}>
<View style={styles.toggleTextWrap}>
<Text style={styles.toggleTitle}>Service ouvert</Text>
<Text style={styles.toggleText}>
Le restaurant accepte les commandes DelishAfrica.
</Text>
</View>
<Switch value={serviceOpen} onValueChange={setServiceOpen} />
</View>

<Pressable style={styles.primaryButton} onPress={save}>
<Text style={styles.primaryButtonText}>
{saved ? "Mettre à jour le partenaire" : "Enregistrer le partenaire"}
</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/orders" as any)}>
<Text style={styles.secondaryButtonText}>Voir les commandes</Text>
</Pressable>

<Pressable style={styles.backButton} onPress={() => router.replace("/")}>
<Text style={styles.backText}>Retour espace partenaire</Text>
</Pressable>

<Text style={styles.note}>
Profil partenaire prêt. Les informations seront utilisées pour fluidifier les commandes et le suivi restaurant.
</Text>
</ScrollView>
</KeyboardAvoidingView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
flex: { flex: 1 },
safe: { flex: 1, backgroundColor: "#120806" },
page: { padding: 22, paddingBottom: 70 },
header: { marginBottom: 22 },
brand: {
color: "#FFB56B",
fontSize: 20,
fontWeight: "900",
letterSpacing: 7,
marginBottom: 10,
},
title: {
color: "#FFF8F0",
fontSize: 38,
lineHeight: 44,
fontWeight: "900",
},
subtitle: {
color: "#D9C6B8",
fontSize: 17,
lineHeight: 26,
marginTop: 12,
fontWeight: "600",
},
statusCard: {
backgroundColor: "#FFF4E8",
borderRadius: 28,
padding: 22,
marginBottom: 18,
},
statusKicker: {
color: "#8C5B35",
fontSize: 14,
fontWeight: "900",
letterSpacing: 5,
marginBottom: 8,
},
statusTitle: {
color: "#1E0A05",
fontSize: 27,
lineHeight: 33,
fontWeight: "900",
marginBottom: 10,
},
statusText: {
color: "#7D6757",
fontSize: 16,
lineHeight: 24,
fontWeight: "700",
},
card: {
backgroundColor: "#2A130D",
borderColor: "rgba(255,181,107,0.22)",
borderWidth: 1,
borderRadius: 26,
padding: 18,
marginBottom: 18,
},
cardTitle: {
color: "#FFF8F0",
fontSize: 25,
fontWeight: "900",
marginBottom: 16,
},
label: {
color: "#FFB56B",
fontSize: 14,
fontWeight: "900",
letterSpacing: 3,
marginBottom: 8,
textTransform: "uppercase",
},
input: {
backgroundColor: "#150A07",
borderColor: "rgba(255,181,107,0.24)",
borderWidth: 1,
borderRadius: 18,
color: "#FFF8F0",
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
backgroundColor: "#22100B",
borderColor: "rgba(255,181,107,0.25)",
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
color: "#FFF8F0",
fontSize: 19,
fontWeight: "900",
marginBottom: 6,
},
toggleText: {
color: "#D9C6B8",
fontSize: 15,
lineHeight: 22,
fontWeight: "600",
},
primaryButton: {
backgroundColor: "#FF8B35",
borderRadius: 22,
paddingVertical: 19,
paddingHorizontal: 22,
alignItems: "center",
marginTop: 4,
marginBottom: 14,
},
primaryButtonText: {
color: "#180A05",
fontSize: 19,
fontWeight: "900",
textAlign: "center",
},
secondaryButton: {
backgroundColor: "#24110C",
borderColor: "rgba(255,255,255,0.14)",
borderWidth: 1,
borderRadius: 22,
paddingVertical: 18,
paddingHorizontal: 22,
alignItems: "center",
marginBottom: 14,
},
secondaryButtonText: {
color: "#FFF8F0",
fontSize: 18,
fontWeight: "900",
textAlign: "center",
},
backButton: {
paddingVertical: 20,
alignItems: "center",
},
backText: {
color: "#FFB56B",
fontSize: 18,
fontWeight: "900",
},
note: {
color: "#9D887A",
fontSize: 13,
lineHeight: 20,
textAlign: "center",
marginTop: 8,
fontWeight: "600",
},
});
