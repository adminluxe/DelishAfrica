import React from "react";
import { Redirect } from "expo-router";

/** Retired demo order surface. Production orders must use authenticated real flows. */
export default function RetiredOrdersDemoRoute() {
  return <Redirect href={"/" as any} />;
}
