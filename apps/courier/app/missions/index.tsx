import React from "react";
import { Redirect } from "expo-router";

/** SURFACE FUTURE V1 — retired legacy route: index */
export default function RetiredLegacyRoute() {
  return <Redirect href={"/orders" as any} />;
}
