import React, { PropsWithChildren, ReactElement, useMemo } from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
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
          scale: interpolate(
            y,
            [-headerHeight, 0],
            [1.35, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // Couleur par défaut si rien n’est passé
  const bg = useMemo(() => {
    if (!headerBackgroundColor) return "transparent";
    // on choisit light par défaut (notre UI est dark, mais ce bg n’impacte pas la lisibilité)
    return headerBackgroundColor.light ?? "transparent";
  }, [headerBackgroundColor]);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        // ✅ Scroll garanti (même si quelqu’un avait mis false dans une ancienne version)
        scrollEnabled={true}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // iOS: meilleur comportement de safe-area
        contentInsetAdjustmentBehavior="automatic"
        // évite que les pressables bloquent la scroll si on tap dedans
        keyboardShouldPersistTaps="handled"
        // important: le header ne doit pas bloquer
        {...scrollProps}
        style={[styles.scroll, style]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.header,
            { height: headerHeight, backgroundColor: bg },
            headerAnimatedStyle,
          ]}
        >
          {headerImage}
        </Animated.View>

        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    width: "100%",
    overflow: "hidden",
  },
  content: {
    flexGrow: 1,
    paddingBottom: Platform.select({ ios: 80, default: 72 }),
  },
});
