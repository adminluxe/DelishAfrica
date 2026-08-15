/**
 * P4A8B Mission Live — shared foreground courier location contract.
 *
 * This contract is additive. It never mutates order status and it only
 * describes an explicitly consented foreground signal for an active mission.
 */

export const LIVE_COURIER_LOCATION_SCHEMA_VERSION = 1 as const;

export type LiveCourierLocationStage = "to_restaurant" | "to_customer";
export type LiveCourierLocationFreshness =
  | "live"
  | "recent"
  | "stale"
  | "stopped"
  | "missing";

export interface LiveCourierLocationPoint {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  capturedAt: string;
  receivedAt: string;
}

export interface LiveCourierLocationSnapshot {
  schemaVersion: typeof LIVE_COURIER_LOCATION_SCHEMA_VERSION;
  orderId: string;
  courierId: string;
  courierName: string;
  statusSnapshot: "ready" | "picked_up";
  stage: LiveCourierLocationStage;
  point: LiveCourierLocationPoint;
  sequence: number;
  active: boolean;
  consent: "explicit_foreground_mission";
  source: "courier_foreground";
  assignmentVerified: boolean;
  staleAfterSeconds: number;
  stoppedAt?: string;
  stopReason?: string;
}

export interface LiveCourierLocationReadResponse {
  ok: boolean;
  orderId: string;
  freshness: LiveCourierLocationFreshness;
  ageSeconds: number | null;
  location: LiveCourierLocationSnapshot | null;
  error?: string;
}

export function isLiveCourierLocationSnapshot(
  value: unknown,
): value is LiveCourierLocationSnapshot {
  if (!value || typeof value !== "object") return false;
  const location = value as Partial<LiveCourierLocationSnapshot>;
  const point = location.point as Partial<LiveCourierLocationPoint> | undefined;

  return (
    location.schemaVersion === LIVE_COURIER_LOCATION_SCHEMA_VERSION &&
    typeof location.orderId === "string" &&
    typeof location.courierId === "string" &&
    typeof location.courierName === "string" &&
    (location.statusSnapshot === "ready" ||
      location.statusSnapshot === "picked_up") &&
    (location.stage === "to_restaurant" || location.stage === "to_customer") &&
    typeof point?.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point?.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    typeof point?.capturedAt === "string" &&
    typeof point?.receivedAt === "string" &&
    typeof location.sequence === "number" &&
    typeof location.active === "boolean" &&
    location.consent === "explicit_foreground_mission" &&
    location.source === "courier_foreground"
  );
}
