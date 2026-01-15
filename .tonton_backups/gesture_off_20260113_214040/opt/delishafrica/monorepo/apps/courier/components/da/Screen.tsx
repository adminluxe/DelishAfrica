import React from "react";
import { View, ViewProps, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = ViewProps & {
  children: React.ReactNode;
  padded?: boolean;
  headerSafe?: boolean;
  topOffset?: number;
};

export function Screen({
  children,
  style,
  padded = true,
  headerSafe = true,
  topOffset = 10,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();

  const topSafe =
    headerSafe
      ? (insets.top || 0) +
        (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0) +
        topOffset
      : 0;

  return (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          paddingTop: topSafe,
          paddingLeft: padded ? 18 : 0,
          paddingRight: padded ? 18 : 0,
          paddingBottom: padded ? Math.max(insets.bottom, 16) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
