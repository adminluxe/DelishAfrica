import React from "react";
import { View, Text } from "react-native";

export default function OrdersDemoRoute() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>Orders Demo</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>
        Route placeholder (ghostbuster forced default export)
      </Text>
    </View>
  );
}
