export type DelishAccent = "client" | "merchant" | "courier" | string;

type ThemePalette = {
brand: string;
brand2: string;
ok: string;
bg: string;
card: string;
text: string;
subtext: string;
border: string;
};

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

const PRESETS: Record<"client" | "merchant" | "courier", ThemePalette> = {
client: {
brand: "#2E5BFF",
brand2: "#8A5BFF",
ok: "#34C759",
bg: "#070A12",
card: "#0E1425",
text: "#F4F7FF",
subtext: "#AAB6D6",
border: "#1E2A4D",
},
merchant: {
brand: "#FF6A2A",
brand2: "#FFB547",
ok: "#34C759",
bg: "#070A12",
card: "#111421",
text: "#FFF6EF",
subtext: "#D7B7A3",
border: "#2B2530",
},
courier: {
brand: "#22C55E",
brand2: "#60A5FA",
ok: "#34C759",
bg: "#070A12",
card: "#0B1720",
text: "#F2FFFA",
subtext: "#9FC7B8",
border: "#153642",
},
};

/**
* makeTheme() supports:
* - "client" | "merchant" | "courier"
* - "#RRGGBB" direct accent color
*/
export function makeTheme(accent: DelishAccent = "client") {
const a = (accent || "client").toString().trim().toLowerCase();

let colors: ThemePalette | null =
a === "merchant" ? PRESETS.merchant :
a === "courier" ? PRESETS.courier :
a === "client" ? PRESETS.client :
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

// Legacy aliases used by older screens.
...legacy,

// Modern usage + compatibility aliases.
colors: {
...colors,
accent: colors.brand,
primary: colors.brand,
secondary: colors.brand2,
success: colors.ok,
danger: "#FF3B30",
warn: "#FF9500",
overlay: "rgba(0,0,0,0.55)",
shimmerBase: "rgba(255,255,255,0.08)",
shimmerGlow: "rgba(255,255,255,0.18)",
},
};
}

export function getTheme(accent: DelishAccent = "client") {
return makeTheme(accent);
}
