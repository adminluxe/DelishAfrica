import React, { useMemo, useState } from "react";
import {
Alert,
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

type ClientProfileLite = {
id: string;
firstName: string;
lastName: string;
phone: string;
email: string;
address: string;
city: string;
instructions: string;
consent: boolean;
updatedAt: string;
};

const PROFILE_KEY = "__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__";

function globalBag(): Record<string, unknown> {
return globalThis as unknown as Record<string, unknown>;
}

function clean(value: string): string {
return String(value || "").trim();
}

function normalizeEmail(value: string): string {
return clean(value).toLowerCase();
}

function digitsOnly(value: string): string {
return String(value || "").replace(/[^\d+]/g, "");
}

function isValidEmail(value: string): boolean {
return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}

function isValidPhone(value: string): boolean {
const digits = digitsOnly(value).replace(/^\+/, "");
return digits.length >= 7 && digits.length <= 15;
}

function readProfile(): ClientProfileLite | null {
const value = globalBag()[PROFILE_KEY];
if (!value || typeof value !== "object") return null;
return value as ClientProfileLite;
}

function buildErrors(profile: {
firstName: string;
lastName: string;
phone: string;
email: string;
address: string;
city: string;
consent: boolean;
}) {
const errors: string[] = [];

if (clean(profile.firstName).length < 2) {
errors.push("Prénom obligatoire, 2 caractères minimum.");
}

if (clean(profile.lastName) && clean(profile.lastName).length < 2) {
errors.push("Nom trop court.");
}

if (!isValidPhone(profile.phone)) {
errors.push("Téléphone invalide.");
}

if (!isValidEmail(profile.email)) {
errors.push("Email invalide.");
}

if (clean(profile.address).length < 5) {
errors.push("Adresse obligatoire.");
}

if (clean(profile.city).length < 2) {
errors.push("Ville obligatoire.");
}

if (!profile.consent) {
errors.push("Consentement client obligatoire.");
}

return errors;
}

export default function ClientSpaceScreen() {
const existing = readProfile();

const [firstName, setFirstName] = useState(existing?.firstName || "");
const [lastName, setLastName] = useState(existing?.lastName || "");
const [phone, setPhone] = useState(existing?.phone || "");
const [email, setEmail] = useState(existing?.email || "");
const [address, setAddress] = useState(existing?.address || "");
const [city, setCity] = useState(existing?.city || "");
const [instructions, setInstructions] = useState(existing?.instructions || "");
const [consent, setConsent] = useState(Boolean(existing?.consent));
const [touched, setTouched] = useState(false);

const errors = useMemo(
() =>
buildErrors({
firstName,
lastName,
phone,
email,
address,
city,
consent,
}),
[firstName, lastName, phone, email, address, city, consent]
);

const ready = errors.length === 0;

function saveProfile(continueToCheckout = false) {
setTouched(true);

if (!ready) {
Alert.alert("Informations à compléter", errors.join("\n"));
return;
}

const profile: ClientProfileLite = {
id: existing?.id || `client-${Date.now()}`,
firstName: clean(firstName),
lastName: clean(lastName),
phone: clean(phone),
email: normalizeEmail(email),
address: clean(address),
city: clean(city),
instructions: clean(instructions),
consent: true,
updatedAt: new Date().toISOString(),
};

globalBag()[PROFILE_KEY] = profile;

if (continueToCheckout) {
router.push("/checkout-preflight" as any);
return;
}

Alert.alert("Espace Client prêt", "Vos informations sont complètes pour continuer vers la commande.");
}

return (
<SafeAreaView style={styles.safe}>
<ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.title}>Espace Client</Text>
<Text style={styles.subtitle}>
Ces informations sécurisent la commande, la livraison et le suivi.
</Text>

<View style={styles.card}>
<Text style={styles.kicker}>IDENTITÉ</Text>

<Text style={styles.label}>Prénom *</Text>
<TextInput
value={firstName}
onChangeText={setFirstName}
placeholder="Votre prénom"
placeholderTextColor="rgba(255,255,255,0.36)"
style={styles.input}
onBlur={() => setTouched(true)}
/>

<Text style={styles.label}>Nom</Text>
<TextInput
value={lastName}
onChangeText={setLastName}
placeholder="Votre nom"
placeholderTextColor="rgba(255,255,255,0.36)"
style={styles.input}
/>

<Text style={styles.label}>Téléphone *</Text>
<TextInput
value={phone}
onChangeText={setPhone}
placeholder="+32 4..."
placeholderTextColor="rgba(255,255,255,0.36)"
keyboardType="phone-pad"
textContentType="telephoneNumber"
style={styles.input}
onBlur={() => setTouched(true)}
/>

<Text style={styles.label}>Email *</Text>
<TextInput
value={email}
onChangeText={setEmail}
placeholder="client@exemple.com"
placeholderTextColor="rgba(255,255,255,0.36)"
keyboardType="email-address"
textContentType="emailAddress"
autoComplete="email"
autoCapitalize="none"
autoCorrect={false}
style={styles.input}
onBlur={() => setTouched(true)}
/>
</View>

<View style={styles.card}>
<Text style={styles.kicker}>LIVRAISON</Text>

<Text style={styles.label}>Adresse *</Text>
<TextInput
value={address}
onChangeText={setAddress}
placeholder="Rue, numéro, appartement"
placeholderTextColor="rgba(255,255,255,0.36)"
style={styles.input}
onBlur={() => setTouched(true)}
/>

<Text style={styles.label}>Ville *</Text>
<TextInput
value={city}
onChangeText={setCity}
placeholder="Bruxelles"
placeholderTextColor="rgba(255,255,255,0.36)"
style={styles.input}
onBlur={() => setTouched(true)}
/>

<Text style={styles.label}>Instructions livreur</Text>
<TextInput
value={instructions}
onChangeText={setInstructions}
placeholder="Sonnez puis appelez si besoin."
placeholderTextColor="rgba(255,255,255,0.36)"
style={[styles.input, styles.multiline]}
multiline
/>
</View>

<View style={styles.consentCard}>
<View style={{ flex: 1 }}>
<Text style={styles.consentTitle}>Consentement client *</Text>
<Text style={styles.consentText}>
J’autorise DelishAfrica à utiliser ces informations pour préparer, livrer et suivre ma commande.
</Text>
</View>
<Switch value={consent} onValueChange={setConsent} />
</View>

{touched && !ready ? (
<View style={styles.errorBox}>
<Text style={styles.errorTitle}>À compléter</Text>
{errors.map((error) => (
<Text key={error} style={styles.errorText}>• {error}</Text>
))}
</View>
) : null}

<Pressable
onPress={() => saveProfile(false)}
style={[styles.primaryButton, !ready && styles.primaryButtonDisabled]}
>
<Text style={styles.primaryButtonText}>Mettre à jour mon espace</Text>
</Pressable>

<Pressable
onPress={() => saveProfile(true)}
style={[styles.secondaryButton, !ready && styles.secondaryButtonDisabled]}
>
<Text style={styles.secondaryButtonText}>Continuer vers la commande</Text>
</Pressable>

<Pressable style={styles.backButton} onPress={() => router.replace("/" as any)}>
<Text style={styles.backText}>Retour à l’accueil</Text>
</Pressable>

<Text style={styles.note}>
Les champs marqués * sont obligatoires. Un profil vide ou incomplet ne peut pas être validé.
</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: "#050B1D" },
page: { padding: 22, paddingBottom: 70 },
brand: {
color: "#F8D17A",
fontSize: 23,
fontWeight: "900",
letterSpacing: 8,
marginBottom: 10,
},
title: {
color: "#FFFFFF",
fontSize: 42,
lineHeight: 48,
fontWeight: "900",
},
subtitle: {
color: "#C4CAD8",
fontSize: 17,
lineHeight: 26,
marginTop: 12,
marginBottom: 20,
fontWeight: "600",
},
card: {
borderRadius: 28,
padding: 20,
backgroundColor: "#121A2B",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16,
},
kicker: {
color: "#F8D17A",
fontSize: 13,
fontWeight: "900",
letterSpacing: 5,
marginBottom: 14,
},
label: {
color: "#F8D17A",
fontSize: 13,
fontWeight: "900",
letterSpacing: 3,
marginTop: 10,
marginBottom: 8,
textTransform: "uppercase",
},
input: {
minHeight: 58,
borderRadius: 18,
paddingHorizontal: 16,
paddingVertical: 14,
backgroundColor: "#080D1B",
borderWidth: 1,
borderColor: "rgba(248,209,122,0.24)",
color: "#FFFFFF",
fontSize: 18,
fontWeight: "700",
},
multiline: {
minHeight: 86,
textAlignVertical: "top",
},
consentCard: {
borderRadius: 24,
padding: 18,
backgroundColor: "rgba(248,209,122,0.10)",
borderWidth: 1,
borderColor: "rgba(248,209,122,0.24)",
marginBottom: 16,
flexDirection: "row",
alignItems: "center",
gap: 12,
},
consentTitle: {
color: "#FFFFFF",
fontSize: 22,
fontWeight: "900",
marginBottom: 6,
},
consentText: {
color: "#C4CAD8",
fontSize: 15,
lineHeight: 22,
fontWeight: "600",
},
errorBox: {
borderRadius: 22,
padding: 16,
backgroundColor: "rgba(220,38,38,0.14)",
borderWidth: 1,
borderColor: "rgba(248,113,113,0.35)",
marginBottom: 16,
},
errorTitle: {
color: "#FCA5A5",
fontSize: 18,
fontWeight: "900",
marginBottom: 8,
},
errorText: {
color: "#FCA5A5",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
},
primaryButton: {
borderRadius: 24,
paddingVertical: 18,
alignItems: "center",
backgroundColor: "#F8D17A",
marginTop: 4,
marginBottom: 12,
},
primaryButtonDisabled: {
opacity: 0.55,
},
primaryButtonText: {
color: "#111827",
fontSize: 20,
fontWeight: "900",
},
secondaryButton: {
borderRadius: 24,
paddingVertical: 18,
alignItems: "center",
backgroundColor: "#121A2B",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16,
},
secondaryButtonDisabled: {
opacity: 0.55,
},
secondaryButtonText: {
color: "#FFFFFF",
fontSize: 19,
fontWeight: "900",
},
backButton: {
paddingVertical: 14,
alignItems: "center",
},
backText: {
color: "#F8D17A",
fontSize: 18,
fontWeight: "900",
},
note: {
color: "rgba(255,255,255,0.42)",
fontSize: 13,
lineHeight: 20,
textAlign: "center",
marginTop: 10,
},
});
