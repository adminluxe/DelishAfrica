import React from "react";
import { Redirect } from "expo-router";

/** Retired static partner showcase. Merchant truth lives in the authenticated partner space. */
export default function RetiredMerchantExploreRoute() {
  return <Redirect href={"/partner-space" as any} />;
}
