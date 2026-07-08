import type { DAApp } from "./tokens";

export type DAColors = {
  bg0: string;
  bg1: string;
  surface0: string;
  surface1: string;
  border: string;

  text: string;
  text2: string;
  muted: string;

  accent: string;
  accent2: string;

  success: string;
  warn: string;
  error: string;

  focus: string;
};

const base = {
  bg0: "#0B0F1A",
  bg1: "#10172A",
  surface0: "#141C2E",
  surface1: "#18233A",
  border: "#26324D",

  text: "#EAF0FF",
  text2: "#C9D4F2",
  muted: "#8FA0C6",

  // prestige + trust
  accent: "#D6B45B",   // gold soft
  accent2: "#4DC0FF",  // azure

  success: "#33D6A2",
  warn: "#FFB020",
  error: "#FF4D5A",

  focus: "#89E0FF",
} satisfies DAColors;

const byApp: Record<DAApp, Partial<DAColors>> = {
  client:  { accent2: "#55D6FF" },
  courier: { accent2: "#7CFFCB" },
  merchant:{ accent2: "#FF7CD6" },
};

export function getDAColors(app: DAApp): DAColors {
  return { ...base, ...byApp[app] } as DAColors;
}
