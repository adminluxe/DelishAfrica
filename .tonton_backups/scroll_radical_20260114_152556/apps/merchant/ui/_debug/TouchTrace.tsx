import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";

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

      {/* Badge */}
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

      {/* SCROLL PROBE (doit scroller quoi qu'il arrive si le scroll n'est pas volé) */}
      <View
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          width: 180,
          height: 220,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.10)",
          zIndex: 999999,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 10 }}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => console.log(`[SCROLLBEGIN] ScrollProbe ${label} ✅`)}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <Text key={i} style={{ color: "white", fontSize: 12, marginBottom: 6 }}>
              Probe line {i + 1}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
