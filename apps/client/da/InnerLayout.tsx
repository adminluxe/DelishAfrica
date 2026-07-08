import React from "react";
import { Stack } from "expo-router";
import { DAThemeProvider } from "@delishafrica/ui";

import BrandBackground from "../components/BrandBackground";

export default function RootLayout() {
  return (
    <BrandBackground>
      <DAThemeProvider app="client">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade"
        }}
      />
    </DAThemeProvider>
    </BrandBackground>
  );
}
