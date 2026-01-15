#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/touchtrace_scrollprobe_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/touchtrace_scrollprobe_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

echo "Backup=$BACKUP_DIR" | tee -a "$REPORT"

for app in client courier merchant; do
  F="$ROOT/apps/$app/ui/_debug/TouchTrace.tsx"
  if [[ ! -f "$F" ]]; then
    echo "Missing: $F" | tee -a "$REPORT"
    continue
  fi

  backup_file "$F"

  cat >"$F" <<'TS'
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
TS

  echo "Patched: $F" | tee -a "$REPORT"
done

echo "Report=$REPORT" | tee -a "$REPORT"
echo "Rollback: rsync -a $BACKUP_DIR/ $ROOT/" | tee -a "$REPORT"
