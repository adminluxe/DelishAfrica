import React, { createContext, useContext, useMemo } from "react";
import { DATheme, themes } from "./tokens";

type Ctx = { theme: DATheme };
const ThemeCtx = createContext<Ctx>({ theme: themes.client });

export function DAThemeProvider({ app, children }: { app: DATheme["name"]; children: React.ReactNode }) {
  const value = useMemo(() => ({ theme: themes[app] }), [app]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useDATheme() {
  return useContext(ThemeCtx).theme;
}
