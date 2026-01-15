import React from "react";
import OnboardingGate from "./components/OnboardingGate";
import Signature from "./screens/SignatureHomeClient";

export default function UI() {
  return (
    <OnboardingGate accent="client">
      <Signature />
    </OnboardingGate>
  );
}
