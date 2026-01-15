import { ScrollView } from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingGate from "./components/OnboardingGate";
import Signature from "./screens/SignatureHomeCourier";

export default function UI() {
  return (
    <OnboardingGate accent="courier">
      <Signature />
    </OnboardingGate>
  );
}

/** Injected fallback Screen (ScrollView) */
export function Screen({ children, style, scroll = true, ...props }: any) {
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 64, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
