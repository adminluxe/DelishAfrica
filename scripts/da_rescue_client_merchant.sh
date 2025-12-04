#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="/opt/delishafrica/compose"
MONO_DIR="/opt/delishafrica/monorepo"

echo "[DA][rescue] Patch Merchant HapticTab (suppression de @react-navigation/elements)..."

patch_haptic_tab() {
  local ROOT="$1"
  local FILE="$ROOT/apps/merchant/components/haptic-tab.tsx"

  if [ -f "$FILE" ]; then
    echo "  -> Patch de $FILE"

    cat > "$FILE" <<'TSX'
import React from 'react';
import {
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, children, ...rest } = props;

  const handlePress = (event: GestureResponderEvent) => {
    // On tente le haptique sans casser l'app si ça échoue
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (onPress) {
      onPress(event);
    }
  };

  return (
    <TouchableOpacity {...rest} onPress={handlePress}>
      {children}
    </TouchableOpacity>
  );
}
TSX
  else
    echo "  -> HapticTab introuvable sous $ROOT, je passe."
  fi
}

# Patch dans monorepo (source actuelle) et compose (au cas où)
patch_haptic_tab "$MONO_DIR"
patch_haptic_tab "$COMPOSE_DIR"

echo "[DA][rescue] Patch Merchant terminé."
echo

###############################################
# 2. Client : repasser sur une App classique  #
###############################################

echo "[DA][rescue] Configuration Client en entrée Expo classique..."

CLIENT_DIR="$MONO_DIR/apps/client"
CLIENT_PKG="$CLIENT_DIR/package.json"

if [ -f "$CLIENT_PKG" ]; then
  echo "  -> Mise à jour de main dans package.json (expo/AppEntry)"

  if command -v jq >/dev/null 2>&1; then
    TMP="$(mktemp)"
    jq '.main = "expo/AppEntry"' "$CLIENT_PKG" > "$TMP"
    mv "$TMP" "$CLIENT_PKG"
  else
    # Fallback sed si jq n'est pas installé
    if grep -q '"main"' "$CLIENT_PKG"; then
      sed -i 's#"main"[[:space:]]*:[[:space:]]*".*"#"main": "expo/AppEntry"#' "$CLIENT_PKG"
    else
      TMP="$(mktemp)"
      awk 'NR==1{print; print "  \"main\": \"expo/AppEntry\","; next}1' "$CLIENT_PKG" > "$TMP"
      mv "$TMP" "$CLIENT_PKG"
    fi
  fi
else
  echo "  ⚠️ package.json Client introuvable sous $CLIENT_DIR"
fi

# App.tsx de secours (si absent ou si tu veux écraser, tu pourras relancer le script)
if [ ! -d "$CLIENT_DIR" ]; then
  echo "  ⚠️ Dossier Client introuvable sous $CLIENT_DIR"
else
  echo "  -> Création / mise à jour de App.tsx de secours"

  cat > "$CLIENT_DIR/App.tsx" <<'TSX'
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
} from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        <Text style={styles.title}>DelishAfrica Client</Text>
        <Text style={styles.subtitle}>Demo Thieyp – Mode secours</Text>
        <Text style={styles.text}>
          L&apos;essentiel pour ta démo : l&apos;app démarre proprement, sans écran rouge,
          prête à accueillir le menu du restaurant et le flux complet.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ff7a00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#000000aa',
    padding: 24,
    borderRadius: 16,
    maxWidth: 340,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd699',
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    color: '#f5f5f5',
    textAlign: 'center',
  },
});
TSX

  # index.ts → enregistrement de l'app
  if [ ! -f "$CLIENT_DIR/index.ts" ] && [ ! -f "$CLIENT_DIR/index.js" ]; then
    echo "  -> Création de index.ts (registerRootComponent)"
    cat > "$CLIENT_DIR/index.ts" <<'TS'
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
TS
  else
    echo "  -> index.ts / index.js existe déjà, je ne touche pas."
  fi
fi

echo
echo "[DA][rescue] Patch terminé."
echo "  ➜ Relance maintenant les Metro bundlers (da_mux ou npx expo start --dev-client)"
echo "  ➜ Puis ferme / rouvre les apps sur l'iPhone pour tester."
