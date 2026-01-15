import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView, Text, TextInput, Pressable } from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  async function onLogin() {
    globalThis.DEV_TOKEN = `dev:${email || "demo@user"}`;
    router.replace("/");
  }
  return (
    <SafeAreaView style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:20, fontWeight:"600", marginBottom:12 }}>Connexion</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemple.com"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth:1, borderColor:"#ddd", borderRadius:10, padding:12 }}
      />
      <Pressable onPress={onLogin} style={{ marginTop:12, padding:14, backgroundColor:"black", borderRadius:10 }}>
        <Text style={{ color:"white", textAlign:"center" }}>Continuer</Text>
      </Pressable>
    </SafeAreaView>
  );
}
