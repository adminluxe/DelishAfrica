import { useEffect, useMemo, useRef, useState } from "react";

export type LiveMapCoordinate = {
  latitude: number;
  longitude: number;
};

type LiveMapEngineOptions = {
  routeCoordinates: LiveMapCoordinate[];
  running: boolean;
  enabled: boolean;
  cycleDurationMs?: number;
  tickMs?: number;
};

type LiveMapEngineResult = {
  courier: LiveMapCoordinate;
  progress: number;
  progressValue: number;
  heading: number;
};

// DA_P3A2_COURIER_MOTION_ENGINE_RUNTIME_V2_V1
function headingBetween(
  start: LiveMapCoordinate,
  end: LiveMapCoordinate,
): number {
  const latitude1 = (start.latitude * Math.PI) / 180;
  const latitude2 = (end.latitude * Math.PI) / 180;
  const longitudeDelta =
    ((end.longitude - start.longitude) * Math.PI) / 180;

  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) *
      Math.cos(latitude2) *
      Math.cos(longitudeDelta);

  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function interpolateCoordinate(
  start: LiveMapCoordinate,
  end: LiveMapCoordinate,
  fraction: number,
): LiveMapCoordinate {
  const safeFraction = Math.max(0, Math.min(1, fraction));

  return {
    latitude:
      start.latitude +
      (end.latitude - start.latitude) * safeFraction,
    longitude:
      start.longitude +
      (end.longitude - start.longitude) * safeFraction,
  };
}

// DA_P3A9_ORGANIC_ARRIVAL_MOTION_ENGINE_RUNTIME_V2_V1
function organicArrivalProgress(progressValue: number): number {
  const clamped = Math.max(0, Math.min(1, progressValue));

  if (clamped <= 0.8) return clamped;

  const localProgress = (clamped - 0.8) / 0.2;
  const easedProgress = 1 - (1 - localProgress) ** 2;

  return 0.8 + easedProgress * 0.2;
}

export function useLiveMapEngine({
  routeCoordinates,
  running,
  enabled,
  cycleDurationMs = 18000,
  tickMs = 80,
}: LiveMapEngineOptions): LiveMapEngineResult {
  const [progressValue, setProgressValue] = useState(0);
  const elapsedRef = useRef(0);
  const previousTickRef = useRef<number | null>(null);

  const routeSignature = useMemo(
    () =>
      routeCoordinates
        .map(
          (point) =>
            `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`,
        )
        .join("|"),
    [routeCoordinates],
  );

  useEffect(() => {
    elapsedRef.current = 0;
    previousTickRef.current = null;
    setProgressValue(0);
  }, [routeSignature]);

  useEffect(() => {
    previousTickRef.current = null;

    if (
      !enabled ||
      !running ||
      elapsedRef.current >= cycleDurationMs ||
      routeCoordinates.length < 2 ||
      cycleDurationMs <= 0
    ) {
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const previous = previousTickRef.current ?? now;
      previousTickRef.current = now;

      const delta = Math.max(0, Math.min(250, now - previous));
      // DA_P3A11C_TERMINAL_WRAPAROUND_RESCUE_RUNTIME_V2_V1E
      elapsedRef.current = Math.min(
        cycleDurationMs,
        (elapsedRef.current + delta),
      );

      // DA_P3A11B_TERMINAL_ARRIVAL_LIFECYCLE_ENGINE_RUNTIME_V2_V1
      const nextProgress = Math.min(
        1,
        elapsedRef.current / cycleDurationMs,
      );

      setProgressValue(nextProgress);

      if (nextProgress >= 1) {
        elapsedRef.current = cycleDurationMs;
        clearInterval(timer);
      }
    }, Math.max(32, tickMs));

    return () => clearInterval(timer);
  }, [
    cycleDurationMs,
    enabled,
    routeCoordinates.length,
    routeSignature,
    running,
    tickMs,
  ]);

  const motion = useMemo(() => {
    if (routeCoordinates.length === 0) {
      return {
        courier: { latitude: 0, longitude: 0 },
        heading: 0,
      };
    }

    if (routeCoordinates.length === 1) {
      return {
        courier: routeCoordinates[0],
        heading: 0,
      };
    }

    // DA_P3A12_TERMINAL_DESTINATION_LOCK_ENGINE_RUNTIME_V2_V1
    if (progressValue >= 1) {
      const terminalCoordinate =
        routeCoordinates[routeCoordinates.length - 1];
      const terminalPreviousCoordinate =
        routeCoordinates[routeCoordinates.length - 2] ??
        terminalCoordinate;

      return {
        courier: terminalCoordinate,
        heading: headingBetween(
          terminalPreviousCoordinate,
          terminalCoordinate,
        ),
      };
    }

    const segmentCount = routeCoordinates.length - 1;
    const visualProgressValue =
      organicArrivalProgress(progressValue);
    const scaled = visualProgressValue * segmentCount;
    const startIndex = Math.min(
      segmentCount - 1,
      Math.floor(scaled),
    );
    const localProgress = scaled - startIndex;
    const start = routeCoordinates[startIndex];
    const end = routeCoordinates[startIndex + 1];

    return {
      courier: interpolateCoordinate(start, end, localProgress),
      heading: headingBetween(start, end),
    };
  }, [progressValue, routeCoordinates]);

  const { courier, heading } = motion;

  const progress = Math.max(
    0,
    Math.min(100, Math.round(progressValue * 100)),
  );

  return {
    courier,
    progress,
    progressValue,
    heading,
  };
}
