#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/touchtrace_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/touchtrace_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

write_touchtrace(){
  local app="$1"
  local appdir="$ROOT/apps/$app/app"
  local compdir="$appdir/_components"
  mkdir -p "$compdir"
  local f="$compdir/TouchTrace.tsx"
  backup_file "$f"

  cat >"$f" <<'TS'
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
TS
}

patch_layout_wrap_slot(){
  local f="$1"
  local importPath="$2"   # "./_components/TouchTrace" or "../_components/TouchTrace"
  local label="$3"

  [[ -f "$f" ]] || return 0
  backup_file "$f"

  python3 - "$f" "$importPath" "$label" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
imp = sys.argv[2]
label = sys.argv[3]

s = p.read_text(encoding="utf-8", errors="ignore")
before = s

# add import if missing
if "TouchTrace" not in s:
    # insert after last import line
    lines = s.splitlines(True)
    idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith("import "):
            idx = i + 1
    lines.insert(idx, f'import {{ TouchTrace }} from "{imp}";\n')
    s = "".join(lines)

# wrap <Slot />
if "<Slot" in s and "TouchTrace" in s:
    # replace first "<Slot" selfclosing or not
    # case 1: <Slot />
    s2 = re.sub(r'<Slot\s*/>', f'<TouchTrace label="{label}"><Slot /></TouchTrace>', s, count=1)
    if s2 == s:
        # case 2: <Slot></Slot>
        s2 = re.sub(r'<Slot\s*>', f'<TouchTrace label="{label}"><Slot>', s, count=1)
        s2 = re.sub(r'</Slot\s*>', r'</Slot></TouchTrace>', s2, count=1)
    s = s2

# wrap <Stack ...> if no Slot found
if s == before and "<Stack" in s and "TouchTrace" in s:
    # try to wrap return root by wrapping first <Stack .../>
    s2 = re.sub(r'(<Stack\b[^;]*?/>)', f'<TouchTrace label="{label}">\\1</TouchTrace>', s, count=1)
    s = s2

if s != before:
    p.write_text(s, encoding="utf-8", errors="ignore")
PY
}

log "📌 TouchTrace install + patch layouts (3 apps)"
for app in client courier merchant; do
  log "→ app=$app"
  write_touchtrace "$app"

  # patch app/_layout.tsx if exists
  L1="$ROOT/apps/$app/app/_layout.tsx"
  patch_layout_wrap_slot "$L1" "./_components/TouchTrace" "$app"

  # patch app/(tabs)/_layout.tsx if exists (common in expo-router)
  L2="$ROOT/apps/$app/app/(tabs)/_layout.tsx"
  patch_layout_wrap_slot "$L2" "../_components/TouchTrace" "$app"
done

log "✅ Done. Report=$REPORT"
log "🧯 Rollback from $BACKUP_DIR (or git checkout -- .)"
