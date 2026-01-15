import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";

export default function TouchTrace({ label, children }: { label: string; children: React.ReactNode }) {
  const [n, setN] = useState(0);
  const last = useRef<number>(0);

  useEffect(() => {
    console.log(`[TOUCHTRACE] mounted: ${label}`);
  }, [label]);

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={() => {
        setN((x) => x + 1);
        console.log(`[TOUCH ${label}] start`);
      }}
      onTouchMove={() => {
        const t = Date.now();
        if (t - last.current > 800) {
          last.current = t;
          console.log(`[TOUCH ${label}] move`);
        }
      }}
    >
      {children}

      {/* Badge visible (ne capte pas les touches) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.70)",
          zIndex: 99999,
        }}
      >
        <Text style={{ color: "white", fontSize: 12, fontWeight: "800" }}>
          TOUCH {label}: {n}
        </Text>
      </View>
    </View>
  );
}
