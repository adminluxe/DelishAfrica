export type WaterTone = "client" | "merchant" | "courier";
export type WaterMode = "radar" | "pulse" | "oracle";

export const WATER_MOTION = {
  currentMs: 7600,
  pulseMs: 3600,
  pressScale: 0.992,
} as const;

export const WATER_TONES = {
  client: {
    background: "rgba(5, 35, 34, 0.78)",
    border: "rgba(116, 225, 200, 0.30)",
    current: "rgba(116, 225, 200, 0.15)",
    currentStrong: "rgba(140, 247, 234, 0.22)",
    signal: "#74E1C8",
    accent: "#F1C064",
    title: "#FFF6E7",
    body: "rgba(231, 242, 237, 0.70)",
    chip: "rgba(116, 225, 200, 0.10)",
  },
  merchant: {
    background: "rgba(45, 27, 14, 0.78)",
    border: "rgba(232, 165, 83, 0.30)",
    current: "rgba(232, 165, 83, 0.14)",
    currentStrong: "rgba(243, 190, 107, 0.20)",
    signal: "#E4A653",
    accent: "#F0C078",
    title: "#FFF2DF",
    body: "rgba(247, 236, 220, 0.70)",
    chip: "rgba(232, 165, 83, 0.10)",
  },
  courier: {
    background: "rgba(4, 39, 31, 0.78)",
    border: "rgba(91, 224, 177, 0.30)",
    current: "rgba(91, 224, 177, 0.14)",
    currentStrong: "rgba(117, 239, 164, 0.20)",
    signal: "#69DDB7",
    accent: "#F0BF68",
    title: "#F0FFF9",
    body: "rgba(226, 242, 236, 0.70)",
    chip: "rgba(91, 224, 177, 0.10)",
  },
} as const;

export const WATER_MARKERS: Record<WaterMode, readonly [string, string, string]> = {
  radar: ["RADAR", "CURRENT", "CHOIX"],
  pulse: ["PULSE", "TIDE", "CHOIX"],
  oracle: ["ORACLE", "CURRENT", "CHOIX"],
};
