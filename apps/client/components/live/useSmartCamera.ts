import { RefObject, useEffect, useRef } from "react";

type SmartCameraCoordinate = {
  latitude: number;
  longitude: number;
};

type SmartCameraOptions = {
  mapRef: RefObject<any>;
  courier: SmartCameraCoordinate;
  heading: number;
  running: boolean;
  enabled: boolean;
  throttleMs?: number;
};

type CameraPoint = SmartCameraCoordinate | null;

const LOCAL_LATITUDE_DELTA = 0.035;
const LOCAL_LONGITUDE_DELTA = 0.035;
const MIN_MOVE_METERS = 28;
const CAMERA_DURATION_MS = 780;

function distanceMeters(
  start: SmartCameraCoordinate,
  end: SmartCameraCoordinate,
): number {
  const earthRadiusMeters = 6371000;
  const latitude1 = (start.latitude * Math.PI) / 180;
  const latitude2 = (end.latitude * Math.PI) / 180;
  const latitudeDelta =
    ((end.latitude - start.latitude) * Math.PI) / 180;
  const longitudeDelta =
    ((end.longitude - start.longitude) * Math.PI) / 180;

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function useSmartCamera({
  mapRef,
  courier,
  heading: _heading,
  running,
  enabled,
  throttleMs = 1100,
}: SmartCameraOptions): void {
  const lastUpdateRef = useRef(0);
  const lastCameraPointRef = useRef<CameraPoint>(null);

  useEffect(() => {
    if (!enabled || !running) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) return;

    const previousPoint = lastCameraPointRef.current;

    if (
      previousPoint &&
      distanceMeters(previousPoint, courier) < MIN_MOVE_METERS
    ) {
      return;
    }

    const map = mapRef.current;
    if (!map || typeof map.animateToRegion !== "function") return;

    lastUpdateRef.current = now;
    lastCameraPointRef.current = courier;

    map.animateToRegion(
      {
        latitude: courier.latitude,
        longitude: courier.longitude,
        latitudeDelta: LOCAL_LATITUDE_DELTA,
        longitudeDelta: LOCAL_LONGITUDE_DELTA,
      },
      CAMERA_DURATION_MS,
    );
  }, [
    courier.latitude,
    courier.longitude,
    enabled,
    mapRef,
    running,
    throttleMs,
  ]);
}
