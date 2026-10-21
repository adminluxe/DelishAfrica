import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

/**
 * Retired map route kept only for old deep links.
 * The integrated map is the single production navigation surface and never invents coordinates.
 */
export default function RetiredCourierRealMapRedirect() {
  const params = useLocalSearchParams<{
    orderId?: string | string[];
    publicId?: string | string[];
  }>();

  const orderId = first(params.publicId || params.orderId).trim();

  if (!orderId) {
    return <Redirect href={"/courier-integrated-map" as any} />;
  }

  return (
    <Redirect
      href={{
        pathname: "/courier-integrated-map",
        params: { orderId, launch: "legacy-real-map" },
      } as any}
    />
  );
}
