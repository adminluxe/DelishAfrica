import React from "react";
import { Redirect } from "expo-router";

/**
 * Retired internal payment-readiness laboratory.
 * Store runtime always routes payment through the real cart/checkout flow.
 */
export default function RetiredPaymentReadinessRoute() {
  return <Redirect href={"/cart" as any} />;
}
