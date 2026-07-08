export type DATheme = {
  name: "client" | "courier" | "merchant";
  brand: string;        // primary
  brand2: string;       // accent
  bg: string;           // app background
  card: string;         // card background
  text: string;         // primary text
  muted: string;        // secondary text
  border: string;       // separators
  success: string;
  warning: string;
  danger: string;
};

export const base = {
  radius: { sm: 10, md: 16, lg: 22 },
  space: { xs: 6, sm: 10, md: 16, lg: 22, xl: 28 },
  font: { h1: 28, h2: 20, body: 16, small: 13, micro: 11 }
};

export const themes: Record<DATheme["name"], DATheme> = {
  client: {
    name: "client",
    brand: "#0B3C5D",
    brand2: "#1D9BF0",
    bg: "#070A0F",
    card: "#0C1220",
    text: "#EEF2FF",
    muted: "#A6B0C3",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  },
  courier: {
    name: "courier",
    brand: "#2F855A",
    brand2: "#34D399",
    bg: "#06110C",
    card: "#071E14",
    text: "#ECFDF5",
    muted: "#9AB8AA",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  },
  merchant: {
    name: "merchant",
    brand: "#C05621",
    brand2: "#FB923C",
    bg: "#120A06",
    card: "#1C0F09",
    text: "#FFF7ED",
    muted: "#C9B6AB",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  }
};
