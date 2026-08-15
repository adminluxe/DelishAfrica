import React from "react";
import { Redirect } from "expo-router";

/**
 * Legacy compatibility route.
 * The old demo operations screen is retired; all operational truth lives in /ops-dashboard.
 */
export default function OpsLegacyRedirect() {
  return <Redirect href={"/ops-dashboard" as any} />;
}
