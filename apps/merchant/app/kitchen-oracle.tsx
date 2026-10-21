import React from "react";
import { Redirect } from "expo-router";

/** Retired until Kitchen Oracle is backed exclusively by live order data. */
export default function RetiredKitchenOracleRoute() {
  return <Redirect href={"/kitchen-pulse" as any} />;
}
