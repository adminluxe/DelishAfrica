import React from "react";
import { Redirect } from "expo-router";

/** SURFACE FUTURE V1 — retired legacy route: mission */
export default function RetiredLegacyRoute() {
  return <Redirect href={"/orders" as any} />;
}
