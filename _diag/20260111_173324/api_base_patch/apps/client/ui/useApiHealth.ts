import { useCallback, useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";

type HealthState =
  | { status: "idle" | "loading" }
  | { status: "ok"; ms: number; apiBaseUrl: string }
  | { status: "error"; message: string; apiBaseUrl: string };

function getApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra =
    (extra.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
    (extra.EXPO_PUBLIC_API_URL as string | undefined);

  const fromEnv =
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_API_URL as string | undefined);

  return (fromEnv || fromExtra || "https://api.delishafrica.me/api/v1").replace(/\/+$/, "");
}

export function useApiHealth() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [state, setState] = useState<HealthState>({ status: "idle" });

  const ping = useCallback(async () => {
    setState({ status: "loading" });
    const url = `${apiBaseUrl}/api/health`;

    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const ms = Date.now() - started;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState({ status: "ok", ms, apiBaseUrl });
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Timeout (4.5s)"
          : (e?.message ?? "Erreur inconnue");
      setState({ status: "error", message: msg, apiBaseUrl });
    } finally {
      clearTimeout(t);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    ping();
  }, [ping]);

  return { state, ping };
}