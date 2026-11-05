// DA_GALA_INTERACTION_OSMOSIS_V1 - shared actions inherit each app chroma while deep surfaces breathe more freely; no new timer, dependency or business mutation.
// DA_GALA_DEEP_OSMOSIS_V1 - deep navigation adopts the same emerald/amber living field as the hero surfaces; translucent cards preserve water continuity without changing business logic.
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

const palettes: Record<DAApp, DAColors> = {
  client: {
    bg0: "#001B16",
    bg1: "#052A22",
    surface0: "rgba(7,49,41,0.82)",
    surface1: "rgba(10,66,55,0.72)",
    border: "rgba(111,223,218,0.18)",
    text: "#FFF4E6",
    text2: "#BED0C6",
    muted: "#82A79B",
    accent: "#F0B44A",
    accent2: "#6DE2D0",
    success: "#70E2B0",
    warn: "#F4BC59",
    error: "#FF6F78",
    focus: "#9AF3E4",
  },
  merchant: {
    bg0: "#0B120E",
    bg1: "#17110B",
    surface0: "rgba(44,29,18,0.88)",
    surface1: "rgba(58,38,22,0.80)",
    border: "rgba(238,168,74,0.24)",
    text: "#FFF4E8",
    text2: "#CAB9A8",
    muted: "#9C8A79",
    accent: "#E9A64B",
    accent2: "#69D8C1",
    success: "#72DFAE",
    warn: "#F2B761",
    error: "#FF746C",
    focus: "#8CEBD5",
  },
  courier: {
    bg0: "#00170F",
    bg1: "#05281C",
    surface0: "rgba(5,46,33,0.90)",
    surface1: "rgba(8,63,44,0.80)",
    border: "rgba(117,239,164,0.22)",
    text: "#F3FFF7",
    text2: "#C6E5D1",
    muted: "#85AF94",
    accent: "#F0B44A",
    accent2: "#75EFA4",
    success: "#75EFA4",
    warn: "#F2B761",
    error: "#FF746C",
    focus: "#A8FBC5",
  },
};

export function getDAColors(app: DAApp): DAColors {
  return palettes[app];
}
