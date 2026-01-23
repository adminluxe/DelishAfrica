import { Link, Stack } from "expo-router";
import { SafeAreaView, Text, View } from "react-native";

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Stack.Screen options={{ title: "DelishAfrica — Home" }} />
      <View style={{ gap: 16 }}>
        <Link href="/restaurants"><Text style={{ fontSize: 18 }}>🍽️ Voir les restaurants</Text></Link>
        <Link href="/auth/login"><Text style={{ fontSize: 16, color: "#6b7280" }}>Se connecter (léger)</Text></Link>
      </View>
    </SafeAreaView>
  );
}
