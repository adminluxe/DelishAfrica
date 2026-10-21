import React from "react";
import { Redirect } from "expo-router";

/** Retired internal showcase. No fixture content is exposed in Store builds. */
export default function RetiredClientShowcaseRoute() {
  return <Redirect href={"/" as any} />;
}
