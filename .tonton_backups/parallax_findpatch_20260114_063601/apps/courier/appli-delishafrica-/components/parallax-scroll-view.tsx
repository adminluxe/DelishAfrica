import React from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * SAFE VERSION (debug):
 * - Neutralise tout comportement parallax/gesture.
 * - Objectif: restaurer le scroll à 100%.
 * - Une fois OK, on pourra réintroduire le parallax proprement.
 */
export type ParallaxScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: { light: string; dark: string } | string;
};

export default function ParallaxScrollView({
  children,
  style,
  contentContainerStyle,
  headerImage,
}: ParallaxScrollViewProps) {
  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView")}
    >
      {headerImage ? (
        <View pointerEvents="none" style={styles.header}>
          {headerImage}
        </View>
      ) : null}

      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  header: { width: "100%" },
  content: { flex: 1 },
});
