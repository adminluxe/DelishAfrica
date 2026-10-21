import React from "react";
import { Redirect } from "expo-router";

/** Retired laboratory deep-link kept only for backward compatibility. */
export default function RetiredMapsLiveLabRoute() {
  return <Redirect href={"/maps-live" as any} />;
}
