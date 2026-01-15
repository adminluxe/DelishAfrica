import { ScrollView } from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OnboardingGate from "./components/OnboardingGate";
import Signature from "./screens/SignatureHomeMerchant";

export default function UI() {
  return (
    <OnboardingGate accent="merchant">
      <Signature />
    </OnboardingGate>
  );
}
