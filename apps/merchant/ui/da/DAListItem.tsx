import React from "react";
import { Pressable, View, Text } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: DAApp = "merchant";

export function DAListItem(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  app?: DAApp;
}){
  const app = props.app ?? APP;
  const t = getDATheme(app);

  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [{
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface0,
        borderRadius: t.radius.lg,
        paddingVertical: 12,
        paddingHorizontal: 14,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.space.x3 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.colors.text, fontWeight: "800" }}>{props.title}</Text>
          {props.subtitle ? (
            <Text style={{ color: t.colors.text2, marginTop: 4, fontWeight: "500", opacity: 0.9 }}>
              {props.subtitle}
            </Text>
          ) : null}
        </View>
        {props.right ? <View>{props.right}</View> : null}
      </View>
    </Pressable>
  );
}
