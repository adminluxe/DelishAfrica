import React from "react";
import { View } from "react-native";

/**
 * TouchTrace (NOOP)
 * ----------------
 * Un traceur de touch global peut voler le responder et tuer ScrollView/FlatList.
 * On garde l'API mais on rend le composant totalement transparent.
 *
 * Réactivation future (si besoin) : créer un TouchTraceDebug séparé
 * qui NE capture PAS le responder (pas de PanResponder "true", pas de GestureDetector global).
 */
export type TouchTraceProps = { children?: React.ReactNode };

export default function TouchTrace({ children }: TouchTraceProps) {
  return (
    <View style={{ flex: 1 }} pointerEvents="box-none">
      {children}
    </View>
  );
}
