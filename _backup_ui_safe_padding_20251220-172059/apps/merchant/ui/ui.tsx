import React from "react";
import OnboardingGate from "./components/OnboardingGate";
import Signature from "./screens/SignatureHomeMerchant";

export default function UI() {
  return (
    <OnboardingGate accent="merchant">
      <Signature />
    </OnboardingGate>
  );
}
