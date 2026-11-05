import { daOrdersFetch } from "./daOrdersApi";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  journeyDistanceMeters, journeyEta, verifiedJourneyRoute,
  type JourneyMode, type JourneyPoint, type JourneyRoute,
} from "../../../packages/contracts/src/missionJourney";

type Options = {
  apiBaseUrl: string; orderId: string; origin: JourneyPoint | null;
  destination: JourneyPoint | null; mode: JourneyMode | null;
  phase: string; enabled: boolean;
};

export type JourneyRouteProblem =
  | "none" | "session" | "forbidden" | "rate_limited"
  | "endpoint_missing" | "server" | "provider"
  | "unverified" | "network";

/** BCP-47 language from device, no native dependency or additional permissions. */
export function preferredRouteLanguage(): string {
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().locale || "fr";
    const match = /^([A-Za-z]{2,3})(?:-([A-Za-z]{2}|[0-9]{3}))?(?:-|$)/.exec(raw);
    return match ? match[1].toLowerCase() + (match[2] ? "-" + match[2].toUpperCase() : "") : "fr";
  } catch { return "fr"; }
}

function serverProblem(status: number): JourneyRouteProblem {
  if (status === 401) return "session";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 404) return "endpoint_missing";
  if (status >= 500) return "server";
  return "network";
}

/** Only verified Google polyline can activate in-app routing or ETA.
 * Never synthesize a route when consent, identity, destination, or provider fails.
 * No token, address or coordinates are logged or exposed as diagnostics.
 */
export function useJourneyRoute(options: Options) {
  const current = useRef(options);
  current.current = options;
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [unavailable, setUnavailable] = useState(false);
  const [problem, setProblem] = useState<JourneyRouteProblem>("none");
  const originAvailable = Boolean(options.origin);
  const destinationLatitude = options.destination?.latitude;
  const destinationLongitude = options.destination?.longitude;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let flight = false;
    let controller: AbortController | null = null;
    let lastAttempt = 0;
    let previousOrigin: JourneyPoint | null = null;
    setRoute(null);
    setUnavailable(false);
    setProblem("none");

    async function update(force = false) {
      const value = current.current;
      if (!value.enabled || !value.orderId || !value.origin || !value.destination || !value.mode) return;
      if (AppState.currentState && AppState.currentState !== "active") return;
      if (flight) return;
      const time = Date.now();
      const moved = !previousOrigin || journeyDistanceMeters(previousOrigin, value.origin) >= 100;
      if (!force && time - lastAttempt < 60_000 && !moved) return;
      if (!force && time - lastAttempt < 30_000) return;

      flight = true;
      lastAttempt = time;
      previousOrigin = value.origin;
      setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await daOrdersFetch(value.apiBaseUrl + "/routes/mission-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            origin: { lat: value.origin.latitude, lng: value.origin.longitude },
            destination: { lat: value.destination.latitude, lng: value.destination.longitude },
            mode: value.mode, orderId: value.orderId, source: "mission-journey",
            languageCode: preferredRouteLanguage(),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!cancelled) {
            setRoute(null);
            setUnavailable(true);
            setProblem(serverProblem(response.status));
          }
          return;
        }
        const body = await response.json().catch(() => null);
        const matches = !body?.meta?.orderId || body.meta.orderId === value.orderId;
        const modeMatches = !body?.meta?.mode || body.meta.mode === value.mode;
        const next = matches && modeMatches ? verifiedJourneyRoute(body, value.mode) : null;
        if (!cancelled) {
          setRoute(next);
          setUnavailable(!next);
          setProblem(next ? "none" : body?.fallback ? "provider" : "unverified");
        }
      } catch {
        if (!cancelled) {
          setRoute(null);
          setUnavailable(true);
          setProblem("network");
        }
      } finally {
        clearTimeout(timeout);
        flight = false;
        if (!cancelled) setLoading(false);
      }
    }

    void update(true);
    const timer = setInterval(() => void update(), 10_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void update(true);
    });
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
      appState.remove();
    };
  }, [options.apiBaseUrl, options.orderId, options.phase, options.mode, options.enabled,
    originAvailable, destinationLatitude, destinationLongitude, revision]);

  const validRoute = route && now - route.computedAtMs <= 90_000 ? route : null;
  const eta = options.enabled ? journeyEta(validRoute, options.origin, now) : null;
  return {
    route: options.enabled ? validRoute : null,
    eta, loading, unavailable, problem,
    refresh: () => setRevision((value) => value + 1),
  };
}
