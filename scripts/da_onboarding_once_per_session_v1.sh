#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backup_onboarding_once_session_$TS"

echo "== DelishAfrica | Onboarding once per session (V1) =="
echo "Backup: $BACKUP"
mkdir -p "$BACKUP"

APP_CLIENT="$ROOT/apps/client"
APP_MERCHANT="$ROOT/apps/merchant"
APP_COURIER="$ROOT/apps/courier"
if [ ! -d "$APP_COURIER" ] && [ -d "$ROOT/apps/coursier" ]; then
  APP_COURIER="$ROOT/apps/coursier"
fi

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  mkdir -p "$BACKUP$(dirname "$f")"
  cp -a "$f" "$BACKUP$f"
}

write_onboarding() {
  local APP="$1"
  local ACCENT="$2"
  local FILE="$APP/ui/screens/Onboarding.tsx"
  mkdir -p "$APP/ui/screens"
  backup_file "$FILE"

  cat > "$FILE" <<'TSX'
import React, { useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getTheme } from "../theme";

type Props = {
  accent?: "client" | "merchant" | "courier" | string;
  onDone?: () => void;
};

function Dot({ active }: { active: boolean }) {
  return <View style={[styles.dot, active ? styles.dotActive : styles.dotIdle]} />;
}

export default function Onboarding({ accent = "client", onDone }: Props) {
  const theme = getTheme(accent);
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const slides = useMemo(
    () => [
      {
        kicker: "ONBOARDING • V1",
        title: "DelishAfrica",
        text: "L’Afrique à table, avec une expérience mobile digne de sa grandeur.",
      },
      {
        kicker: "CULTURE • SAVEURS",
        title: "Découvrir",
        text: "Des cuisines authentiques, des restaurants africains & diasporas — à portée de main.",
      },
      {
        kicker: "COMMANDE • SUIVI",
        title: "Commander & Suivre",
        text: "Un parcours clair : commande → préparation → livraison. Simple. Fluide. Premium.",
      },
    ],
    []
  );

  const barW = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setStep(clamped);
    Animated.timing(progress, {
      toValue: clamped / (slides.length - 1),
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  const handleSkip = () => onDone?.();
  const handleNext = () => {
    if (step >= slides.length - 1) return onDone?.();
    go(step + 1);
  };

  const c = theme.colors;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.kicker, { color: c.subtext }]}>{slides[step].kicker}</Text>
        <Text style={[styles.title, { color: c.text }]}>{slides[step].title}</Text>
        <Text style={[styles.desc, { color: c.subtext }]}>{slides[step].text}</Text>

        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.07)" }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: barW,
                  backgroundColor: c.brand,
                },
              ]}
            />
          </View>

          <View style={styles.dots}>
            {slides.map((_, i) => (
              <Dot key={i} active={i === step} />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.btnGhost,
              { borderColor: c.border, backgroundColor: pressed ? "rgba(255,255,255,0.05)" : "transparent" },
            ]}
          >
            <Text style={[styles.btnText, { color: c.text }]}>Passer</Text>
          </Pressable>

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.btnPrimary,
              { backgroundColor: pressed ? c.brand2 : c.brand },
            ]}
          >
            <Text style={[styles.btnText, { color: "#081018" }]}>{step >= slides.length - 1 ? "Commencer" : "Suivant"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    overflow: "hidden",
  },
  kicker: {
    letterSpacing: 2.6,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  progressRow: {
    gap: 12,
    marginBottom: 16,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dotIdle: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  btnGhost: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
TSX

  echo "Written: $FILE"
}

write_gate() {
  local APP="$1"
  local ACCENT="$2"
  local FILE="$APP/ui/components/OnboardingGate.tsx"
  mkdir -p "$APP/ui/components"
  backup_file "$FILE"

  cat > "$FILE" <<TSX
import React, { useMemo, useState } from "react";
import Onboarding from "../screens/Onboarding";

/**
 * OnboardingGate V1
 * - "once per session" = uses in-memory state + global flag
 * - No AsyncStorage (zero deps, zero native risk)
 */
type Props = {
  accent: "${ACCENT}";
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
TSX

  echo "Written: $FILE"
}

patch_ui_ui_tsx() {
  local APP="$1"
  local ACCENT="$2"
  local FILE="$APP/ui/ui.tsx"
  [ -f "$FILE" ] || { echo "WARN: missing $FILE (skip)"; return 0; }

  backup_file "$FILE"

  # Keep SignatureHome* link as-is, just wrap with OnboardingGate
  # We detect which signature file is referenced, but simplest: keep existing import line and add gate.
  local SIGNATURE_IMPORT
  SIGNATURE_IMPORT="$(grep -E '^import Signature from "\./screens/' "$FILE" || true)"

  if [ -z "$SIGNATURE_IMPORT" ]; then
    # fallback: assume SignatureHomeClient/Merchant/Courier
    local SIGN="SignatureHomeClient"
    [ "$ACCENT" = "merchant" ] && SIGN="SignatureHomeMerchant"
    [ "$ACCENT" = "courier" ] && SIGN="SignatureHomeCourier"
    SIGNATURE_IMPORT="import Signature from \"./screens/${SIGN}\";"
  fi

  cat > "$FILE" <<TSX
import React from "react";
import OnboardingGate from "./components/OnboardingGate";
${SIGNATURE_IMPORT}

export default function UI() {
  return (
    <OnboardingGate accent="${ACCENT}">
      <Signature />
    </OnboardingGate>
  );
}
TSX

  echo "Patched: $FILE (wrapped with OnboardingGate)"
}

# Accent mapping
echo "== Writing onboarding + gate + patch ui/ui.tsx =="
write_onboarding "$APP_CLIENT" "client"
write_gate "$APP_CLIENT" "client"
patch_ui_ui_tsx "$APP_CLIENT" "client"

write_onboarding "$APP_MERCHANT" "merchant"
write_gate "$APP_MERCHANT" "merchant"
patch_ui_ui_tsx "$APP_MERCHANT" "merchant"

write_onboarding "$APP_COURIER" "courier"
write_gate "$APP_COURIER" "courier"
patch_ui_ui_tsx "$APP_COURIER" "courier"

echo "== DONE =="
echo "Backup saved at: $BACKUP"
