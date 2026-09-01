import React from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * PARALLAX LIVE OVERRIDE (safe):
 * - remplace toute implémentation parallax/gesture par un ScrollView simple
 * - conserve un comportement ScrollView simple et prévisible
 */
export type ParallaxScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: any;
};

export default function ParallaxScrollView(props: ParallaxScrollViewProps) {
  const { children, style, contentContainerStyle, headerImage } = props;

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
    >
      {headerImage ? (
        <View pointerEvents="box-none" style={styles.header}>
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
