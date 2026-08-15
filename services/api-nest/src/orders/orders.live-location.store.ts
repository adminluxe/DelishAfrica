import * as fs from "fs";
import * as path from "path";
import { getDemoOrder } from "./orders.demo.store";

type AnyRecord = Record<string, any>;

type LivePoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  capturedAt: string;
  receivedAt: string;
};

type LiveLocationRecord = {
  schemaVersion: 1;
  orderId: string;
  courierId: string;
  courierName: string;
  statusSnapshot: "ready" | "picked_up";
  stage: "to_restaurant" | "to_customer";
  point: LivePoint;
  sequence: number;
  active: boolean;
  consent: "explicit_foreground_mission";
  source: "courier_foreground";
  assignmentVerified: boolean;
  staleAfterSeconds: number;
  stoppedAt?: string;
  stopReason?: string;
  history: LivePoint[];
};

type StoreShape = {
  version: 1;
  updatedAt: string;
  locations: Record<string, LiveLocationRecord>;
};

const STORE_VERSION = 1 as const;
const MAX_HISTORY_POINTS = 24;
const STALE_AFTER_SECONDS = 45;

function nowIso(): string {
  return new Date().toISOString();
}

function storeFile(): string {
  const configured = String(process.env.DA_LIVE_LOCATION_STORE_FILE || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), ".runtime", "orders-live-location-store.json");
}

const STORE_FILE = storeFile();

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreShape {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return { version: STORE_VERSION, updatedAt: nowIso(), locations: {} };
    }

    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : null;
    const locations = parsed && typeof parsed.locations === "object"
      ? parsed.locations
      : {};

    return {
      version: STORE_VERSION,
      updatedAt: String(parsed?.updatedAt || nowIso()),
      locations,
    };
  } catch {
    return { version: STORE_VERSION, updatedAt: nowIso(), locations: {} };
  }
}

function writeStore(store: StoreShape): void {
  try {
    ensureDir();
    const next = { ...store, version: STORE_VERSION, updatedAt: nowIso() };
    const temp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(temp, STORE_FILE);
  } catch {
    // Location persistence must never crash order processing.
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown): string {
  return String(value || "").trim();
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function orderIdFrom(input: AnyRecord): string {
  return text(
    input.orderId ||
      input.publicId ||
      input.id ||
      input.order?.orderId ||
      input.order?.publicId ||
      input.order?.id,
  );
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function assignmentFor(order: AnyRecord): AnyRecord | null {
  const proposal = order?.assignmentProposal;
  return proposal && typeof proposal === "object" ? proposal : null;
}

function freshnessOf(record: LiveLocationRecord | null): {
  freshness: "live" | "recent" | "stale" | "stopped" | "missing";
  ageSeconds: number | null;
} {
  if (!record) return { freshness: "missing", ageSeconds: null };
  const capturedMs = Date.parse(record.point?.capturedAt || record.point?.receivedAt || "");
  const ageSeconds = Number.isFinite(capturedMs)
    ? Math.max(0, Math.floor((Date.now() - capturedMs) / 1000))
    : null;

  if (!record.active) return { freshness: "stopped", ageSeconds };
  if (ageSeconds === null) return { freshness: "stale", ageSeconds };
  if (ageSeconds <= record.staleAfterSeconds) return { freshness: "live", ageSeconds };
  if (ageSeconds <= record.staleAfterSeconds * 2) return { freshness: "recent", ageSeconds };
  return { freshness: "stale", ageSeconds };
}

export function publishDemoOrderLiveLocation(input: AnyRecord = {}): AnyRecord {
  const orderId = orderIdFrom(input);
  const courierId = text(input.courierId);
  const courierName = text(input.courierName || courierId || "Coursier DelishAfrica");
  const latitude = finite(input.latitude ?? input.coords?.latitude ?? input.point?.latitude);
  const longitude = finite(input.longitude ?? input.coords?.longitude ?? input.point?.longitude);

  if (!orderId) return { ok: false, error: "missing_order_id" };
  if (!courierId) return { ok: false, error: "missing_courier_id", orderId };
  if (latitude === null || longitude === null || !validCoordinate(latitude, longitude)) {
    return { ok: false, error: "invalid_coordinates", orderId };
  }

  const order = getDemoOrder(orderId) as AnyRecord | null;
  if (!order) return { ok: false, error: "order_not_found", orderId };

  const status = text(order.status).toLowerCase();
  if (status !== "ready" && status !== "picked_up") {
    return {
      ok: false,
      error: "mission_not_live_shareable",
      orderId,
      status,
      allowedStatuses: ["ready", "picked_up"],
    };
  }

  const proposal = assignmentFor(order);
  const assignmentAccepted = proposal?.status === "accepted";
  const assignedCourierId = text(proposal?.courierId);

  if (!assignmentAccepted) {
    return {
      ok: false,
      error: "assignment_not_accepted",
      orderId,
      status,
    };
  }

  if (assignedCourierId && assignedCourierId !== courierId) {
    return {
      ok: false,
      error: "courier_mismatch",
      orderId,
      assignedCourierId,
      courierId,
    };
  }

  const now = nowIso();
  const capturedCandidate = text(input.capturedAt);
  const capturedMs = Date.parse(capturedCandidate);
  const capturedAt = Number.isFinite(capturedMs) ? new Date(capturedMs).toISOString() : now;
  const accuracyMeters = finite(input.accuracyMeters ?? input.coords?.accuracy);
  const headingDegrees = finite(input.headingDegrees ?? input.coords?.heading);
  const speedMetersPerSecond = finite(input.speedMetersPerSecond ?? input.coords?.speed);

  const store = readStore();
  const previous = store.locations[orderId] || null;
  const point: LivePoint = {
    latitude,
    longitude,
    capturedAt,
    receivedAt: now,
    ...(accuracyMeters !== null && accuracyMeters >= 0 ? { accuracyMeters } : {}),
    ...(headingDegrees !== null && headingDegrees >= 0 ? { headingDegrees } : {}),
    ...(speedMetersPerSecond !== null && speedMetersPerSecond >= 0
      ? { speedMetersPerSecond }
      : {}),
  };

  const history = [...(previous?.history || []), point].slice(-MAX_HISTORY_POINTS);
  const record: LiveLocationRecord = {
    schemaVersion: 1,
    orderId,
    courierId,
    courierName,
    statusSnapshot: status as "ready" | "picked_up",
    stage: status === "picked_up" ? "to_customer" : "to_restaurant",
    point,
    sequence: Math.max(0, Number(previous?.sequence || 0)) + 1,
    active: true,
    consent: "explicit_foreground_mission",
    source: "courier_foreground",
    assignmentVerified: true,
    staleAfterSeconds: STALE_AFTER_SECONDS,
    history,
  };

  store.locations[orderId] = record;
  writeStore(store);

  return {
    ok: true,
    orderId,
    location: clone(record),
    ...freshnessOf(record),
    orderStatusUnchanged: status,
    statusMutation: false,
  };
}

export function getDemoOrderLiveLocation(input: AnyRecord = {}): AnyRecord {
  const orderId = orderIdFrom(input);
  if (!orderId) {
    return {
      ok: false,
      error: "missing_order_id",
      orderId: "",
      location: null,
      freshness: "missing",
      ageSeconds: null,
    };
  }

  const store = readStore();
  const record = store.locations[orderId] || null;
  const freshness = freshnessOf(record);

  if (!record) {
    return {
      ok: false,
      error: "location_not_found",
      orderId,
      location: null,
      ...freshness,
    };
  }

  return {
    ok: true,
    orderId,
    location: clone(record),
    ...freshness,
  };
}

export function stopDemoOrderLiveLocation(input: AnyRecord = {}): AnyRecord {
  const orderId = orderIdFrom(input);
  const courierId = text(input.courierId);
  if (!orderId) return { ok: false, error: "missing_order_id" };

  const store = readStore();
  const previous = store.locations[orderId] || null;
  if (!previous) return { ok: false, error: "location_not_found", orderId };

  if (courierId && previous.courierId !== courierId) {
    return {
      ok: false,
      error: "courier_mismatch",
      orderId,
      courierId,
    };
  }

  const stopped: LiveLocationRecord = {
    ...previous,
    active: false,
    stoppedAt: nowIso(),
    stopReason: text(input.reason || "courier_stopped_foreground_share"),
  };

  store.locations[orderId] = stopped;
  writeStore(store);

  return {
    ok: true,
    orderId,
    location: clone(stopped),
    ...freshnessOf(stopped),
    statusMutation: false,
  };
}

export function getDemoOrderLiveLocationStoreFile(): string {
  return STORE_FILE;
}
