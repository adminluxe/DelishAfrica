import React, { useRef, useState } from "react";
import { View, Text } from "react-native";

export function TouchTrace({ label, children }: { label: string; children: React.ReactNode }) {
  const [n, setN] = useState(0);
  const last = useRef<number>(Date.now());

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={() => {
        const t = Date.now();
        last.current = t;
        setN((x) => x + 1);
        console.log(`[TOUCH ${label}] start #${n + 1}`);
      }}
      onTouchMove={() => {
        // spam-protect: log max ~1/s
        const t = Date.now();
        if (t - last.current > 900) {
          last.current = t;
          console.log(`[TOUCH ${label}] move`);
        }
      }}
    >
      {children}

      {/* badge visible (n'intercepte pas les touches) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.65)",
        }}
      >
        <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
          TOUCH {label}: {n}
        </Text>
      </View>
    </View>
  );
}
