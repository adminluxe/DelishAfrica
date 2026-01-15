export type Theme = {
  accent: string;
  bg0: string;
  bg1: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  ok: string;
  warn: string;
  bad: string;
};

export const makeTheme = (accent: string): Theme => ({
  accent,
  bg0: "#070A12",
  bg1: "#0B1020",
  text: "#F5F7FF",
  muted: "#AAB1C7",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#EF4444",
});