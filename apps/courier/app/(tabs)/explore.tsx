/* DA_V5_QA */
import React, { useEffect } from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Screen, DAHeader, DAFadeIn, StatCard, StatusPill, DAInlineNotice, DAListItem, DAButton } from "../../ui/da";

/**
 * PARALLAX LIVE OVERRIDE (safe):
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
    <Screen pad="lg" scroll>

      <DAHeader title="Explore" />
      <DAFadeIn>

    
/* DA_V4_1_1_FINISH */
      <View style={{ gap: 14, marginTop: 10, marginBottom: 14 }}>
        <DAInlineNotice kind="info" title="Support" body="On te repond vite. Choisis une option." />
        <DAListItem title="Chat support" subtitle="Reponse rapide" right={<StatusPill status="ONLINE" label="OK" />} />
        <DAListItem title="Appeler" subtitle="Pour urgence mission" right={<StatusPill status="WARN" label="Urgent" />} />
        <DAButton label="Ouvrir un ticket" variant="primary" />
      </View>
<ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView ✅")}
    >
      {headerImage ? (
        <View pointerEvents="box-none" style={styles.header}>
          {headerImage}
        </View>
      ) : null}

      <View style={styles.content}>{children}</View>
    </ScrollView>
      </DAFadeIn>
  
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  header: { width: "100%" },
  content: { flex: 1 },
});