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
