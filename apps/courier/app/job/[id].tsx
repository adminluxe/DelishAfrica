import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

/** Legacy deep-link compatibility: always land on the real authenticated mission detail. */
export default function LegacyJobMissionRedirect() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = first(params.id).trim();

  if (!id) {
    return <Redirect href={"/orders" as any} />;
  }

  return (
    <Redirect
      href={{
        pathname: "/mission-detail",
        params: { orderId: id },
      } as any}
    />
  );
}
