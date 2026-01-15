import { Stack } from "expo-router";
import { View } from "react-native";
import { TouchTrace } from "../_components/TouchTrace";
import TouchTrace from "../../ui/_debug/TouchTrace";

export default function RootLayout() {
  return (
    <TouchTrace label="merchant">
<View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#070A10" },
        }}
      />
    </View>
    </TouchTrace>
  );
}
