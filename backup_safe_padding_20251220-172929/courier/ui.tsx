import React from "react";
import OnboardingGate from "./components/OnboardingGate";
import Signature from "./screens/SignatureHomeCourier";

export default function UI() {
  return (
    <OnboardingGate accent="courier">
      <Signature />
    </OnboardingGate>
  );
}
