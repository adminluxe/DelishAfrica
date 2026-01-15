import React, { useEffect } from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * PARALLAX DEBUG OVERRIDE (safe):
 * - remplace toute implémentation parallax/gesture par un ScrollView simple
 * - log au mount + log au scroll begin drag
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

  useEffect(() => {
    console.log("[PARALLAX OVERRIDE] mounted ✅");
  }, []);

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView ✅")}
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
