import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen, DAHeader, DAFadeIn } from "../../ui/da";

function normalizeEmail(value: string) {
return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
const email = normalizeEmail(value);
return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export default function Login() {
const [email, setEmail] = useState("");
const [touched, setTouched] = useState(false);
const router = useRouter();

const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
const emailOk = isValidEmail(normalizedEmail);
const showError = touched && !emailOk;

async function onLogin() {
setTouched(true);

if (!emailOk) {
return;
}

(globalThis as any).DEV_TOKEN = `dev:`;
router.replace("/");
}

return (
<Screen>
<DAHeader title="Connexion" />
<DAFadeIn>
<SafeAreaView style={{ flex: 1, padding: 16 }}>
<Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>
Connexion coursier
</Text>

<Text style={{ color: "#6B7280", marginBottom: 12, lineHeight: 20 }}>
Entrez un email valide pour ouvrir la session progressive DelishAfrica.
</Text>

<TextInput
value={email}
onChangeText={setEmail}
onBlur={() => setTouched(true)}
placeholder="email@exemple.com"
autoCapitalize="none"
autoCorrect={false}
keyboardType="email-address"
textContentType="emailAddress"
autoComplete="email"
style={{
borderWidth: 1,
borderColor: showError ? "#DC2626" : "#ddd",
borderRadius: 10,
padding: 12,
color: "#111827",
backgroundColor: "white",
}}
/>

{showError ? (
<Text style={{ color: "#DC2626", marginTop: 8, lineHeight: 20 }}>
Email invalide. Exemple attendu : coursier@delishafrica.me
</Text>
) : null}

<Pressable
onPress={onLogin}
accessibilityRole="button"
accessibilityState={{ disabled: !emailOk }}
style={{
marginTop: 12,
padding: 14,
backgroundColor: emailOk ? "#059669" : "#D1D5DB",
borderRadius: 10,
}}
>
<Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
Continuer
</Text>
</Pressable>

<View style={{ marginTop: 12 }}>
<Text style={{ color: "#6B7280", fontSize: 12, lineHeight: 18 }}>
La session ne s’active pas si l’email est vide ou mal formé.
</Text>
</View>
</SafeAreaView>
</DAFadeIn>
</Screen>
);
}
