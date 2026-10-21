import React from "react";
import { Redirect } from "expo-router";

/** Retired static prototype kept only as a safe legacy deep-link. */
export default function RetiredKitchenOracleCoreRoute() {
  return <Redirect href={"/kitchen-pulse" as any} />;
}
