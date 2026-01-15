#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/touchtrace_harden_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/touchtrace_harden_$NOW.log"

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
  local f="$ROOT/apps/$app/ui/_debug/TouchTrace.tsx"
  mkdir -p "$(dirname "$f")"
  backup_file "$f"

  cat >"$f" <<'TS'
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
TS
}

remove_old_route_touchtrace(){
  local app="$1"
  local old="$ROOT/apps/$app/app/_components/TouchTrace.tsx"
  if [[ -f "$old" ]]; then
    log "🧹 remove old route file: $old"
    backup_file "$old"
    rm -f "$old"
  fi
}

patch_layouts(){
  local app="$1"
  local app_root="$ROOT/apps/$app"
  local target="$app_root/ui/_debug/TouchTrace.tsx"

  # patch all _layout.tsx under app/
  while IFS= read -r layout; do
    backup_file "$layout"
    python3 - "$layout" "$target" "$app_root" "$app" "$REPORT" <<'PY'
import sys, re, pathlib, os

layout = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
app_root = pathlib.Path(sys.argv[3])
label = sys.argv[4]
report = pathlib.Path(sys.argv[5])

s = layout.read_text(encoding="utf-8", errors="ignore")
before = s

# Skip if already wrapped
if "<TouchTrace" in s or "TouchTrace" in s and "mounted:" in s:
    sys.exit(0)

# Compute import path from layout dir to target
rel = os.path.relpath(target.with_suffix(""), start=layout.parent)  # without extension
if not rel.startswith("."):
    rel = "./" + rel

# Add import after last import line
lines = s.splitlines(True)
ins = 0
for i, line in enumerate(lines):
    if line.strip().startswith("import "):
        ins = i + 1
lines.insert(ins, f'import TouchTrace from "{rel}";\n')
s = "".join(lines)

# Wrap return output (robust)
# Case A: return (
m = re.search(r'\breturn\s*\(\s*', s)
if m:
    s = s[:m.end()] + f'<TouchTrace label="{label}">\n' + s[m.end():]

    # Close wrapper near end: find last occurrence of pattern ");\n}" (return block end)
    matches = list(re.finditer(r'\n\s*\);\s*\n\s*}\s*', s))
    if matches:
        last = matches[-1]
        # insert before the ");"
        s = s[:last.start()] + "\n    </TouchTrace>" + s[last.start():]
    else:
        # fallback: last ");"
        idx = s.rfind(");")
        if idx != -1:
            s = s[:idx] + "</TouchTrace>\n" + s[idx:]
else:
    # Case B: return <...>;
    m2 = re.search(r'\breturn\s*<', s)
    if m2:
        # insert wrapper after "return "
        s = re.sub(r'\breturn\s*<', f'return (<TouchTrace label="{label}"><', s, count=1)
        # close wrapper before the first ";" after that return
        start = s.find("return (")
        if start != -1:
            semi = s.find(";", start)
            if semi != -1:
                s = s[:semi] + "</TouchTrace>)" + s[semi:]

if s != before:
    layout.write_text(s, encoding="utf-8", errors="ignore")
    with report.open("a", encoding="utf-8") as f:
        f.write(f"\n[patched] {layout}\n")
PY
  done < <(find "$app_root/app" -type f -name "_layout.tsx" 2>/dev/null || true)
}

log "🧪 TouchTrace HARDEN start"
for app in client courier merchant; do
  log "→ app=$app"
  write_touchtrace "$app"
  remove_old_route_touchtrace "$app"
  patch_layouts "$app"
done

log "✅ Done"
log "📄 Report: $REPORT"
log "📦 Backup: $BACKUP_DIR"
log "🧯 Rollback: restore from backup dir (or git checkout -- .)"
