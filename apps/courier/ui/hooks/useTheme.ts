import { useMemo } from "react";
import { getTheme } from "../theme";
import { APP_ACCENT } from "../brand/accent";

export function useTheme() {
  return useMemo(() => getTheme(APP_ACCENT), []);
}
