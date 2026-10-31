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

export function useJourneyRoute(options: Options) {
  const current = useRef(options);
  current.current = options;
  const [route, setRoute] = useState<JourneyRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [unavailable, setUnavailable] = useState(false);
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
      setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch(`${value.apiBaseUrl}/routes/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            origin: { lat: value.origin.latitude, lng: value.origin.longitude },
            destination: { lat: value.destination.latitude, lng: value.destination.longitude },
            mode: value.mode, orderId: value.orderId, source: "mission-journey",
          }),
          signal: controller.signal,
        });
        const body = response.ok ? await response.json() : null;
        if (body?.meta?.orderId && body.meta.orderId !== value.orderId) throw new Error("mission_mismatch");
        const next = verifiedJourneyRoute(body, value.mode);
        if (body?.meta?.mode && body.meta.mode !== value.mode) throw new Error("mode_mismatch");
        if (!cancelled) {
          setRoute(next);
          setUnavailable(!next);
          previousOrigin = value.origin;
        }
      } catch {
        if (!cancelled) setUnavailable(true);
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
  }, [options.apiBaseUrl, options.orderId, options.phase, options.mode, options.enabled, originAvailable, destinationLatitude, destinationLongitude, revision]);

  const eta = options.enabled ? journeyEta(route, options.origin, now) : null;
  const validRoute = route && now - route.computedAtMs <= 90_000 ? route : null;
  return { route: options.enabled ? validRoute : null, eta, loading, unavailable, refresh: () => setRevision((value) => value + 1) };
}
