import React from "react";
import { Redirect } from "expo-router";

/** Retired prototype: Store runtime must not expose static route/ETA fixtures. */
export default function RetiredTerrainOsRoute() {
  return <Redirect href={"/live-market" as any} />;
}
