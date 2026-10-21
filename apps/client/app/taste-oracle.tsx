import React from "react";
import { Redirect } from "expo-router";

/**
 * Taste Oracle V1 is retired from Store runtime until recommendations and ETA
 * are backed by live server data instead of editorial fixtures.
 */
export default function RetiredTasteOracleRoute() {
  return <Redirect href={"/live-market" as any} />;
}
