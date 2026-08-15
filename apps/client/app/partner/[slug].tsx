import React, { useMemo } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default function PartnerDetailCompatibilityRoute() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = useMemo(() => firstParam(params.slug) || "thieyp", [params.slug]);

  return <Redirect href={{ pathname: "/restaurant/[id]", params: { id: slug } } as any} />;
}
