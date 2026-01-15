import React from "react";
import { View, Text } from "react-native";
import { DA } from "./theme";

type Props = { status?: string };

function getTone(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "READY") return { bg: "rgba(46,229,157,0.16)", border: "rgba(46,229,157,0.45)", text: "#2EE59D", label: "READY" };
  if (s === "DELIVERED") return { bg: "rgba(124,92,255,0.16)", border: "rgba(124,92,255,0.45)", text: "#7C5CFF", label: "DELIVERED" };
  if (s === "PENDING") return { bg: "rgba(255,138,61,0.16)", border: "rgba(255,138,61,0.45)", text: "#FF8A3D", label: "PENDING" };
  return { bg: "rgba(255,255,255,0.08)", border: DA.stroke, text: DA.sub, label: status || "UNKNOWN" };
}

export function StatusPill({ status }: Props) {
  const tone = getTone(status);
  return (
    <View style={{
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tone.bg,
      borderWidth: 1,
      borderColor: tone.border,
    }}>
      <Text style={{ color: tone.text, fontWeight: "900", letterSpacing: 0.6 }}>
        {tone.label}
      </Text>
    </View>
  );
}
