/** Shared delivery presentation rules. No identity, payment or order mutation. */
export type JourneyPoint = { latitude: number; longitude: number };
export type JourneyMode = "DRIVE" | "TWO_WHEELER" | "BICYCLE" | "WALK";
export type JourneyFreshness = "live" | "recent" | "stale" | "stopped" | "missing";
export type JourneySignal = {
  ok?: boolean;
  freshness?: JourneyFreshness;
  ageSeconds?: number | null;
  receivedAtMs?: number;
  location?: {
    active?: boolean;
    courierName?: string;
    travelMode?: JourneyMode;
    stage?: "to_restaurant" | "to_customer";
    point?: JourneyPoint & {
      accuracyMeters?: number;
      headingDegrees?: number;
      speedMetersPerSecond?: number;
      capturedAt?: string;
      receivedAt?: string;
    };
  } | null;
};

export const JOURNEY_LIVE_SECONDS = 45;
export const JOURNEY_RECENT_SECONDS = 90;
export const JOURNEY_ROUTE_TTL_MS = 90_000;

export function finiteJourneyNumber(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "string" && !value.trim() || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function journeyPoint(value: unknown): JourneyPoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = finiteJourneyNumber(record.latitude ?? record.lat);
  const longitude = finiteJourneyNumber(record.longitude ?? record.lng ?? record.lon);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function firstJourneyPoint(values: unknown[]): JourneyPoint | null {
  for (const value of values) {
    const point = journeyPoint(value);
    if (point) return point;
  }
  return null;
}

export function journeyPickupPoint(order: any): JourneyPoint | null {
  return firstJourneyPoint([order?.pickupLocation, order?.restaurantLocation, order?.merchantLocation,
    order?.restaurant?.location, order?.restaurant, order?.pickup, order?.merchant?.location, order?.pickupCoordinates]);
}

export function journeyDestinationPoint(order: any): JourneyPoint | null {
  return firstJourneyPoint([order?.deliveryLocation, order?.dropoffLocation, order?.delivery?.location,
    order?.customer?.location, order?.delivery?.address, order?.customer?.address, order?.destination,
    order?.dropoff, order?.deliveryCoordinates]);
}

export function journeyOrderId(order: any): string {
  return String(order?.publicId || order?.orderId || order?.id || "").trim();
}

export function journeyStatus(order: any): string {
  return String(order?.status || "").trim().toLowerCase();
}

export function isJourneyDelivered(order: any): boolean {
  return ["delivered", "completed"].includes(journeyStatus(order));
}

export function isJourneyTravelling(order: any): boolean {
  return ["picked_up", "on_the_way", "in_transit"].includes(journeyStatus(order));
}

export function isJourneyActive(order: any): boolean {
  return ["pending", "accepted", "ready", "courier_accepted", "picked_up", "on_the_way", "in_transit"].includes(journeyStatus(order));
}

/** A direct link never falls back to another order. Ambiguity requires a choice. */
export function selectJourneyMission(orders: any[], requestedId = "") {
  const valid = orders.filter((order) => Boolean(journeyOrderId(order)));
  if (requestedId) {
    const order = valid.find((entry) => journeyOrderId(entry) === requestedId) || null;
    return { order, choices: [] as any[], reason: order ? "selected" : "not_found" };
  }
  const active = valid.filter(isJourneyActive);
  const accepted = active.filter((order) => order?.assignmentProposal?.status === "accepted");
  const choices = accepted.length ? accepted : active;
  return {
    order: choices.length === 1 ? choices[0] : null,
    choices: choices.length > 1 ? choices : [],
    reason: choices.length > 1 ? "choose" : choices.length ? "selected" : "empty",
  };
}

export function journeyTravelMode(value: unknown): JourneyMode | null {
  const key = String(value || "").trim().toUpperCase();
  const aliases: Record<string, JourneyMode> = {
    DRIVE: "DRIVE", CAR: "DRIVE", VOITURE: "DRIVE",
    TWO_WHEELER: "TWO_WHEELER", MOTORCYCLE: "TWO_WHEELER", SCOOTER: "TWO_WHEELER", MOTO: "TWO_WHEELER",
    BICYCLE: "BICYCLE", BIKE: "BICYCLE", VELO: "BICYCLE", "VÉLO": "BICYCLE", CYCLING: "BICYCLE",
    WALK: "WALK", WALKING: "WALK", FOOT: "WALK", MARCHE: "WALK",
  };
  return aliases[key] || null;
}

export function journeyAddress(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return [record.label, record.line1, record.line2, record.postalCode, record.city, record.countryCode]
    .filter(Boolean).map((part) => String(part).trim())
    .filter((part, index, all) => part && all.indexOf(part) === index).join(", ");
}

/** Server age plus time since receipt remains correct even when a request fails. */
export function assessJourneySignal(read: JourneySignal | null | undefined, now = Date.now()) {
  const point = journeyPoint(read?.location?.point);
  const elapsed = read?.receivedAtMs === undefined ? 0 : Math.max(0, (now - read.receivedAtMs) / 1000);
  const serverAge = finiteJourneyNumber(read?.ageSeconds);
  const captured = Date.parse(read?.location?.point?.capturedAt || read?.location?.point?.receivedAt || "");
  const ageSeconds = serverAge !== null
    ? Math.max(0, serverAge) + elapsed
    : Number.isFinite(captured) ? Math.max(0, (now - captured) / 1000) : null;
  let freshness: JourneyFreshness = "missing";
  if (read?.freshness === "stopped" || read?.location?.active === false) freshness = "stopped";
  else if (point && read?.ok !== false && read?.location?.active) {
    if (read.freshness === "stale" || ageSeconds === null || ageSeconds > JOURNEY_RECENT_SECONDS) freshness = "stale";
    else freshness = read.freshness === "recent" || ageSeconds > JOURNEY_LIVE_SECONDS ? "recent" : "live";
  }
  const accuracy = finiteJourneyNumber(read?.location?.point?.accuracyMeters);
  const accurate = accuracy === null || (accuracy >= 0 && accuracy <= 100);
  const usable = Boolean(point && accurate && (freshness === "live" || freshness === "recent"));
  const ageLabel = ageSeconds === null ? "" : ageSeconds < 60
    ? `${Math.max(0, Math.floor(ageSeconds))} s`
    : `${Math.floor(ageSeconds / 60)} min`;
  const label = freshness === "missing" ? "En attente de la position du coursier"
    : freshness === "stopped" ? "Partage de position arrêté"
    : !accurate ? "Position imprécise · localisation en cours"
    : freshness === "stale" ? `Dernière position${ageLabel ? ` reçue il y a ${ageLabel}` : " connue"} · actualisation en attente`
    : `Position mise à jour${ageLabel ? ` il y a ${ageLabel}` : ""}`;
  return { point, freshness, ageSeconds, accuracy, usable, label };
}

export function journeyDistanceMeters(a: JourneyPoint, b: JourneyPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/** Project onto segments and measure metres, never the ordinal index of a vertex. */
export function journeyRouteProgress(route: JourneyPoint[], point: JourneyPoint) {
  if (route.length < 2) return null;
  const lengths = route.slice(1).map((end, index) => journeyDistanceMeters(route[index], end));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return null;
  const longitudeScale = Math.cos(point.latitude * Math.PI / 180) * 111_195;
  const latitudeScale = 111_195;
  let offset = 0;
  let nearest = { distanceToRouteMeters: Infinity, travelledMeters: 0 };
  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index]; const end = route[index + 1];
    const ax = (start.longitude - point.longitude) * longitudeScale;
    const ay = (start.latitude - point.latitude) * latitudeScale;
    const dx = (end.longitude - start.longitude) * longitudeScale;
    const dy = (end.latitude - start.latitude) * latitudeScale;
    const squared = dx * dx + dy * dy;
    const t = squared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squared)) : 0;
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (distance < nearest.distanceToRouteMeters) nearest = { distanceToRouteMeters: distance, travelledMeters: offset + t * lengths[index] };
    offset += lengths[index];
  }
  return {
    progress: Math.max(0, Math.min(1, nearest.travelledMeters / total)),
    remainingMeters: Math.max(0, total - nearest.travelledMeters),
    distanceToRouteMeters: nearest.distanceToRouteMeters,
    distanceToDestinationMeters: journeyDistanceMeters(point, route[route.length - 1]),
    totalMeters: total,
  };
}

export function decodeJourneyPolyline(encoded: string): JourneyPoint[] {
  if (!encoded || encoded.length > 100_000) return [];
  const result: JourneyPoint[] = []; let cursor = 0; let latitude = 0; let longitude = 0;
  function component(): number | null {
    let value = 0; let shift = 0;
    for (let count = 0; count < 6 && cursor < encoded.length; count += 1) {
      const byte = encoded.charCodeAt(cursor++) - 63;
      if (byte < 0 || byte > 63) return null;
      value |= (byte & 31) << shift; shift += 5;
      if (byte < 32) return value & 1 ? ~(value >> 1) : value >> 1;
    }
    return null;
  }
  while (cursor < encoded.length) {
    const lat = component(); const lng = component();
    if (lat === null || lng === null) return [];
    latitude += lat; longitude += lng;
    const point = journeyPoint({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
    if (!point) return [];
    result.push(point);
  }
  return result;
}

export type JourneyManeuver = {
  instruction: string;
  maneuver: string;
  distanceMeters: number;
};

export type JourneyRoute = {
  points: JourneyPoint[];
  distanceMeters: number;
  durationSeconds: number;
  computedAtMs: number;
  mode: JourneyMode;
  maneuvers: JourneyManeuver[];
};

export function verifiedJourneyRoute(payload: any, mode: JourneyMode, now = Date.now()): JourneyRoute | null {
  if (!payload?.ok || payload.provider !== "google_routes" || payload.fallback || payload.meta?.mode !== mode) return null;
  const points = decodeJourneyPolyline(String(payload.polyline || ""));
  const distanceMeters = finiteJourneyNumber(payload.distanceMeters);
  const durationSeconds = finiteJourneyNumber(payload.durationSeconds);
  if (points.length < 2 || distanceMeters === null || durationSeconds === null || distanceMeters <= 0 || durationSeconds <= 0) return null;
  const computed = Date.parse(payload.meta?.computedAt || "");
  if (Number.isFinite(computed) && (computed > now + 30_000 || now - computed > JOURNEY_ROUTE_TTL_MS)) return null;
  // Use only instructions returned by the same verified Google route.
  // Never invent a turn or silently treat an unverified estimate as guidance.
  const maneuvers: JourneyManeuver[] = (Array.isArray(payload.maneuvers) ? payload.maneuvers : [])
    .slice(0, 12).map((entry: any) => ({
      instruction: typeof entry?.instruction === "string"
        ? entry.instruction.replace(/<[^>]*>/g, "").replace(/[\x00-\x1f]/g, " ").trim().slice(0, 220) : "",
      maneuver: typeof entry?.maneuver === "string" ? entry.maneuver.trim().slice(0, 64) : "",
      distanceMeters: finiteJourneyNumber(entry?.distanceMeters) ?? -1,
    }))
    .filter((entry: JourneyManeuver) => Boolean(entry.instruction) && entry.distanceMeters >= 0);
  return { points, distanceMeters, durationSeconds, mode, maneuvers,
    computedAtMs: Number.isFinite(computed) ? computed : now };
}

export function journeyEta(route: JourneyRoute | null, point: JourneyPoint | null, now = Date.now()) {
  if (!route || !point || now - route.computedAtMs > JOURNEY_ROUTE_TTL_MS) return null;
  const projection = journeyRouteProgress(route.points, point);
  if (!projection || projection.distanceToRouteMeters > 120) return null;
  const seconds = route.durationSeconds * Math.max(0, 1 - projection.progress);
  const minimum = Math.max(1, Math.floor(seconds / 60));
  const maximum = Math.max(minimum + 1, Math.ceil(seconds / 60 * 1.2));
  return { minimum, maximum, label: `${minimum}–${maximum} min`, distanceMeters: projection.remainingMeters };
}

export function journeyPhase(order: any) {
  const status = journeyStatus(order);
  if (["delivered", "completed"].includes(status)) return { key: "delivered", label: "LIVRAISON TERMINÉE", title: "La remise est confirmée.", accent: "#8EDDB6" };
  if (["cancelled", "canceled", "rejected"].includes(status)) return { key: "cancelled", label: "MISSION TERMINÉE", title: "Cette mission est clôturée.", accent: "#C5C9C4" };
  if (isJourneyTravelling(order)) return { key: "delivery", label: "VERS LE CLIENT", title: "La commande est en route.", accent: "#E6BD72" };
  if (status === "ready") return { key: "pickup", label: "RETRAIT AU RESTAURANT", title: "La commande est prête.", accent: "#8EDDB6" };
  if (["accepted", "courier_accepted"].includes(status)) return { key: "preparing", label: "EN PRÉPARATION", title: "Le restaurant prépare la commande.", accent: "#8EDDB6" };
  return { key: "waiting", label: "COMMANDE EN ATTENTE", title: "Chaque étape apparaîtra ici.", accent: "#B5CCC3" };
}
