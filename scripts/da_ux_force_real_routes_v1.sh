#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backup_force_real_routes_$TS"

echo "== DelishAfrica | Force REAL routes + Theme compat =="
echo "Backup: $BACKUP"
mkdir -p "$BACKUP"

APP_CLIENT="$ROOT/apps/client"
APP_MERCHANT="$ROOT/apps/merchant"
APP_COURIER="$ROOT/apps/courier"
if [ ! -d "$APP_COURIER" ] && [ -d "$ROOT/apps/coursier" ]; then
  APP_COURIER="$ROOT/apps/coursier"
fi

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local dir
  dir="$(dirname "$f")"
  mkdir -p "$BACKUP$dir"
  cp -a "$f" "$BACKUP$f"
}

write_route_wrapper() {
  local APP="$1"
  local SIGNATURE="$2"

  local ROUTE="$APP/app/index.tsx"
  if [ ! -f "$ROUTE" ]; then
    echo "WARN: no $ROUTE (skipping)"
    return 0
  fi

  backup_file "$ROUTE"

  cat > "$ROUTE" <<TSX
import React from "react";
import Signature from "../ui/screens/${SIGNATURE}";

export default function Screen() {
  return <Signature />;
}
TSX

  echo "Patched route: $ROUTE -> ${SIGNATURE}"
}

write_ui_wrapper() {
  local APP="$1"
  local SIGNATURE="$2"
  local UI="$APP/ui/ui.tsx"
  [ -f "$UI" ] || return 0

  backup_file "$UI"
  cat > "$UI" <<TSX
import React from "react";
import Signature from "./screens/${SIGNATURE}";

export default function UI() {
  return <Signature />;
}
TSX
  echo "Patched UI: $UI -> ${SIGNATURE}"
}

write_theme() {
  local APP="$1"
  local DEFAULT_ACCENT="$2"
  local THEME="$APP/ui/theme.ts"

  backup_file "$THEME"

  cat > "$THEME" <<'TS'
export type DelishAccent = "client" | "merchant" | "courier" | string;

export type DelishTheme = ReturnType<typeof makeTheme>;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return { r: 46, g: 91, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mix(hexA: string, hexB: string, t: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}
function isHexColor(s: string) {
  return /^#([0-9a-fA-F]{6})$/.test((s || "").trim());
}

const BASE = {
  radius: { sm: 10, md: 16, lg: 22, xl: 28 },
  space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  font: { h1: 34, h2: 22, h3: 18, body: 16, small: 13 },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    deep: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 7,
    },
  },
};

const PRESETS = {
  client:   { brand: "#2E5BFF", brand2: "#8A5BFF", ok: "#34C759", bg: "#070A12", card: "#0E1425", text: "#F4F7FF", subtext: "#AAB6D6", border: "#1E2A4D" },
  merchant: { brand: "#FF6A2A", brand2: "#FFB547", ok: "#34C759", bg: "#070A12", card: "#111421", text: "#FFF6EF", subtext: "#D7B7A3", border: "#2B2530" },
  courier:  { brand: "#22C55E", brand2: "#60A5FA", ok: "#34C759", bg: "#070A12", card: "#0B1720", text: "#F2FFFA", subtext: "#9FC7B8", border: "#153642" },
} as const;

/**
 * makeTheme() supports:
 * - "client" | "merchant" | "courier"
 * - "#RRGGBB" (direct accent color)
 */
export function makeTheme(accent: DelishAccent = "client") {
  const a = (accent || "client").toString().trim().toLowerCase();

  let colors =
    a === "merchant" ? PRESETS.merchant :
    a === "courier"  ? PRESETS.courier :
    a === "client"   ? PRESETS.client :
    null;

  if (!colors && isHexColor(a)) {
    const brand = a;
    const brand2 = mix(brand, "#FFFFFF", 0.22);
    colors = {
      brand,
      brand2,
      ok: "#34C759",
      bg: "#070A12",
      card: "#0E1425",
      text: "#F4F7FF",
      subtext: "#AAB6D6",
      border: "#1E2A4D",
    };
  }

  if (!colors) colors = PRESETS.client;

  // ✅ IMPORTANT: provide legacy aliases used by old screens (theme.muted, theme.primary, etc.)
  const legacy = {
    primary: colors.brand,
    secondary: colors.brand2,
    muted: colors.subtext,
    background: colors.bg,
    surface: colors.card,
  };

  return {
    accent,
    ...BASE,

    // legacy aliases (top-level)
    ...legacy,

    // modern usage
    colors: {
      ...colors,
      danger: "#FF3B30",
      warn: "#FF9500",
      overlay: "rgba(0,0,0,0.55)",
      shimmerBase: "rgba(255,255,255,0.08)",
      shimmerGlow: "rgba(255,255,255,0.18)",
    },
  };
}

export function getTheme(accent: DelishAccent) {
  return makeTheme(accent);
}
TS

  # Now set default accent by adding a tiny one-liner export (safe)
  # We keep it simple: leave default in makeTheme("client") and call getTheme with app accent in ui.tsx.
  echo "Patched theme: $THEME"
}

echo "== 1) Force REAL routes (app/index.tsx) to Signature =="
write_route_wrapper "$APP_CLIENT"   "SignatureHomeClient"
write_route_wrapper "$APP_MERCHANT" "SignatureHomeMerchant"
write_route_wrapper "$APP_COURIER"  "SignatureHomeCourier"

echo "== 2) Also force ui/ui.tsx to Signature (safety) =="
write_ui_wrapper "$APP_CLIENT"   "SignatureHomeClient"
write_ui_wrapper "$APP_MERCHANT" "SignatureHomeMerchant"
write_ui_wrapper "$APP_COURIER"  "SignatureHomeCourier"

echo "== 3) Theme compat (fix theme.muted crashes) =="
write_theme "$APP_CLIENT"   "client"
write_theme "$APP_MERCHANT" "merchant"
write_theme "$APP_COURIER"  "courier"

echo "== DONE =="
echo "Backup saved at: $BACKUP"
