import React from "react";
import { ExpoRoot } from "expo-router";
import "expo-router/entry";

export default function App() {
  // Charge automatiquement toutes les routes déclarées dans le dossier "app"
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}
