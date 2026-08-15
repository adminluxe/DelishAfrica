import React, { useMemo } from "react";
import { Polyline as NativePolyline } from "react-native-maps";

const Polyline = NativePolyline as React.ComponentType<any>;
// DA_P4A6B_LIVING_ROUTE_CORRIDOR_V1

export type LiveRouteCoordinate = {
  latitude: number;
  longitude: number;
};

type LiveRouteEngineProps = {
  routeCoordinates: LiveRouteCoordinate[];
  progressValue: number;
  baseColor?: string;
  baseWidth?: number;
};

type RouteLayers = {
  travelled: LiveRouteCoordinate[];
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolateCoordinate(
  start: LiveRouteCoordinate,
  end: LiveRouteCoordinate,
  fraction: number,
): LiveRouteCoordinate {
  const safeFraction = clamp(fraction, 0, 1);

  return {
    latitude:
      start.latitude +
      (end.latitude - start.latitude) * safeFraction,
    longitude:
      start.longitude +
      (end.longitude - start.longitude) * safeFraction,
  };
}

function coordinateAt(
  routeCoordinates: LiveRouteCoordinate[],
  progressValue: number,
): {
  coordinate: LiveRouteCoordinate;
  segmentIndex: number;
} {
  if (routeCoordinates.length === 0) {
    return {
      coordinate: { latitude: 0, longitude: 0 },
      segmentIndex: 0,
    };
  }

  if (routeCoordinates.length === 1) {
    return {
      coordinate: routeCoordinates[0],
      segmentIndex: 0,
    };
  }

  const segmentCount = routeCoordinates.length - 1;
  const scaled = clamp(progressValue, 0, 1) * segmentCount;
  const segmentIndex = Math.min(
    segmentCount - 1,
    Math.floor(scaled),
  );
  const localProgress = scaled - segmentIndex;

  return {
    coordinate: interpolateCoordinate(
      routeCoordinates[segmentIndex],
      routeCoordinates[segmentIndex + 1],
      localProgress,
    ),
    segmentIndex,
  };
}

function buildLayers(
  routeCoordinates: LiveRouteCoordinate[],
  progressValue: number,
): RouteLayers {
  if (routeCoordinates.length < 2) {
    return {
      travelled: routeCoordinates,
    };
  }

  const current = coordinateAt(routeCoordinates, progressValue);
  const travelled = [
    ...routeCoordinates.slice(0, current.segmentIndex + 1),
    current.coordinate,
  ];

  return {
    travelled,
  };
}

export function LiveRouteEngine({
  routeCoordinates,
  progressValue,
  baseColor = "#BE6A34",
  baseWidth = 7,
}: LiveRouteEngineProps) {
  // DA_P3A6B_LIVE_ROUTE_CALM_GLOW_RESCUE_RUNTIME_V2_V1
  const visualProgressValue =
    Math.round(clamp(progressValue, 0, 1) * 72) / 72;

  const layers = useMemo(
    () => buildLayers(routeCoordinates, visualProgressValue),
    [routeCoordinates, visualProgressValue],
  );

  if (routeCoordinates.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={routeCoordinates}
        strokeColor="rgba(39, 22, 17, 0.58)"
        strokeWidth={baseWidth + 4}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />

      <Polyline
        coordinates={routeCoordinates}
        strokeColor={baseColor}
        strokeWidth={baseWidth}
        lineCap="round"
        lineJoin="round"
        zIndex={3}
      />

      {layers.travelled.length >= 2 ? (
        <>
          <Polyline
            coordinates={layers.travelled}
            strokeColor="rgba(255, 190, 88, 0.14)"
            strokeWidth={baseWidth + 3}
            lineCap="round"
            lineJoin="round"
            zIndex={4}
          />

          <Polyline
            coordinates={layers.travelled}
            strokeColor="#F6C84A"
            strokeWidth={baseWidth}
            lineCap="round"
            lineJoin="round"
            zIndex={5}
          />
        </>
      ) : null}

    </>
  );
}
