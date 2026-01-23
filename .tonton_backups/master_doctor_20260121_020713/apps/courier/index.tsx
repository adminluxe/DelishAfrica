kimport React from "react";
import { SafeAreaView, ScrollView, View, Text } from "react-native";
import DemoStatusCard from "../src/demo/DemoStatusCard";

const APP_TITLE = "DelishAfrica";
const APP_SUBTITLE = "App Courier • Missions & livraison";
const ROLE_COLOR = "#22C55E";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#07111f" }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        <View style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: 0.2 }}>
            {APP_TITLE}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 16 }}>
            {APP_SUBTITLE}
          </Text>
          <View style={{ marginTop: 10, height: 6, width: 70, borderRadius: 99, backgroundColor: ROLE_COLOR }} />
        </View>

        <DemoStatusCard />

        <View
          style={{
            borderRadius: 18,
            padding: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 }}>
            Mission de démo
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 16, lineHeight: 22 }}>
            Livraison “Thieyp” → bientôt: missions réelles (dispatch), acceptation, navigation, preuve de livraison.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

