import React, { PropsWithChildren, ReactElement, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";

type HeaderBg = { light: string; dark: string };

export type ParallaxScrollViewProps = PropsWithChildren<{
  headerImage?: ReactElement;
  headerBackgroundColor?: HeaderBg;
  headerHeight?: number;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
}> &
  Omit<React.ComponentProps<typeof Animated.ScrollView>, "contentContainerStyle">;

const DEFAULT_HEADER_HEIGHT = 240;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  contentContainerStyle,
  style,
  ...scrollProps
}: ParallaxScrollViewProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const y = scrollOffset.value;
    return {
      transform: [
        {
          translateY: interpolate(
            y,
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(y, [-headerHeight, 0], [1.35, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [headerHeight]);

  const bg = useMemo(() => {
    if (!headerBackgroundColor) return "transparent";
    return headerBackgroundColor.dark ?? headerBackgroundColor.light ?? "transparent";
  }, [headerBackgroundColor]);

  const DIAG = process.env.EXPO_PUBLIC_SCROLL_DIAG === "1";

  return (
    <View style={[styles.container, style]}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={true}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {!!headerImage && (
          <Animated.View
            pointerEvents="none"
            style={[styles.header, { height: headerHeight, backgroundColor: bg }, headerAnimatedStyle]}
          >
            {headerImage}
          </Animated.View>
        )}

        <View style={[styles.content, contentContainerStyle]}>
          {children}

          {DIAG && <View style={styles.diagSpacer} />}
          {DIAG &&
            Array.from({ length: 40 }).map((_, i) => (
              <View key={`diag-${i}`} style={styles.diagRow} />
            ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { width: "100%", overflow: "hidden" },
  content: { flexGrow: 1, padding: 16, gap: 12 },
  diagSpacer: { height: 24 },
  diagRow: { height: 28, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },
});
