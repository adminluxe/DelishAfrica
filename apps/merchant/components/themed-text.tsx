import * as React from "react";
import { Text, type TextProps } from "react-native";

export type ThemedTextProps = TextProps & {
  type?: "default" | "title" | "subtitle" | "defaultSemiBold" | "link";
};

export function ThemedText({ style, ...props }: ThemedTextProps) {
  return <Text style={[{ color: "#EDEDED" }, style]} {...props} />;
}

export default ThemedText;
