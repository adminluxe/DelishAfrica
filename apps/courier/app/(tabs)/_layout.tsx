import { Stack } from "expo-router";
import { View } from "react-native";
export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#070A10" },
        }}
      />
    </View>);
}
