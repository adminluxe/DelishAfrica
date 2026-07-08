import React, { useMemo, useState } from "react";
import Onboarding from "../screens/Onboarding";

/**
 * OnboardingGate V1
 * - "once per session" = uses in-memory state + global flag
 * - No AsyncStorage (zero deps, zero native risk)
 */
type Props = {
  accent: "merchant";
  children: React.ReactNode;
};

export default function OnboardingGate({ accent, children }: Props) {
  const key = useMemo(() => "__DA_ONBOARDING_SHOWN__" + ":" + String(accent), [accent]);

  const initial = (() => {
    try {
      // @ts-ignore
      return !!globalThis[key];
    } catch {
      return false;
    }
  })();

  const [shown, setShown] = useState<boolean>(initial);

  if (!shown) {
    return (
      <Onboarding
        accent={accent}
        onDone={() => {
          try {
            // @ts-ignore
            globalThis[key] = true;
          } catch {}
          setShown(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
