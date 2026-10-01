import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export type AtmosphereMode =
  | "clear"
  | "cloud"
  | "mist"
  | "rain"
  | "storm"
  | "snow"
  | "heat";

export type AtmosphereCurrent = {
  ok: true;
  mode: AtmosphereMode;
  source: "live" | "override" | "stale" | "fallback";
  market: string;
  observedAt: string;
  checkedAt: string;
  metrics: {
    temperatureC: number | null;
    humidityPct: number | null;
    precipitationMm: number | null;
    windKmh: number | null;
    cloudPct: number | null;
    symbolCode: string | null;
  };
  tuning: {
    rain: number;
    wetness: number;
    condensation: number;
    mist: number;
    glint: number;
    motion: number;
  };
  attribution: {
    label: string;
    license: string;
    url: string;
  };
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const REFRESH_MS = __DEV__ ? 45_000 : 10 * 60_000;

const FALLBACK: AtmosphereCurrent = {
  ok: true,
  mode: "clear",
  source: "fallback",
  market: "DelishAfrica",
  observedAt: "",
  checkedAt: "",
  metrics: {
    temperatureC: null,
    humidityPct: null,
    precipitationMm: null,
    windKmh: null,
    cloudPct: null,
    symbolCode: null,
  },
  tuning: {
    rain: 0.08,
    wetness: 0.54,
    condensation: 0.18,
    mist: 0.08,
    glint: 0.92,
    motion: 0.78,
  },
  attribution: {
    label: "MET Norway",
    license: "CC BY 4.0",
    url: "https://api.met.no/",
  },
};

function validMode(value: unknown): value is AtmosphereMode {
  return ["clear", "cloud", "mist", "rain", "storm", "snow", "heat"].includes(
    String(value),
  );
}

function normalized(raw: any): AtmosphereCurrent | null {
  if (!raw || raw.ok !== true || !validMode(raw.mode)) return null;
  const tuning = raw.tuning || {};
  const number = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    ...FALLBACK,
    ...raw,
    tuning: {
      rain: number(tuning.rain, FALLBACK.tuning.rain),
      wetness: number(tuning.wetness, FALLBACK.tuning.wetness),
      condensation: number(
        tuning.condensation,
        FALLBACK.tuning.condensation,
      ),
      mist: number(tuning.mist, FALLBACK.tuning.mist),
      glint: number(tuning.glint, FALLBACK.tuning.glint),
      motion: number(tuning.motion, FALLBACK.tuning.motion),
    },
  };
}

export function useAtmosphereCurrent(): AtmosphereCurrent {
  const [state, setState] = useState<AtmosphereCurrent>(FALLBACK);
  const lastFetchAt = useRef(0);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const refresh = async (force = false) => {
      if (!force && Date.now() - lastFetchAt.current < REFRESH_MS) return;
      lastFetchAt.current = Date.now();
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`${API_BASE}/atmosphere/current`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = normalized(await response.json().catch(() => null));
        if (active && next) setState(next);
      } catch {
        // The atmosphere is enhancement-only: never block the product.
      }
    };

    void refresh(true);
    const timer = setInterval(() => {
      void refresh(true);
    }, REFRESH_MS);

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh(false);
    });

    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return state;
}
