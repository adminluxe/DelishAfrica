import { Injectable } from '@nestjs/common';
import {
RoutePoint,
RoutePreviewInput,
RoutePreviewResponse,
RouteProvider,
RouteTravelMode,
} from './routes-preview.types';

const GOOGLE_ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DEFAULT_SOURCE = 'terrain-os';
const EARTH_RADIUS_KM = 6371;

function toNumber(value: unknown): number | null {
const n = Number(value);
return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min = 0, max = 1): number {
return Math.max(min, Math.min(max, value));
}

function normalizePoint(value: Partial<RoutePoint> | null | undefined): RoutePoint | null {
if (!value || typeof value !== 'object') return null;

const lat = toNumber(value.lat);
const lng = toNumber(value.lng);

if (lat === null || lng === null) return null;
if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

return {
lat,
lng,
label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : undefined,
};
}

function normalizeMode(value: unknown): RouteTravelMode {
const raw = String(value || '').toUpperCase();

if (raw === 'DRIVE') return 'DRIVE';
if (raw === 'TWO_WHEELER') return 'TWO_WHEELER';
if (raw === 'BICYCLE') return 'BICYCLE';
if (raw === 'WALK') return 'WALK';

return 'TWO_WHEELER';
}

function deg2rad(deg: number): number {
return deg * (Math.PI / 180);
}

function haversineMeters(a: RoutePoint, b: RoutePoint): number {
const dLat = deg2rad(b.lat - a.lat);
const dLng = deg2rad(b.lng - a.lng);
const lat1 = deg2rad(a.lat);
const lat2 = deg2rad(b.lat);

const h =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 1000);
}

function estimateDurationSeconds(distanceMeters: number, mode: RouteTravelMode): number {
const speedKmH =
mode === 'WALK' ? 5 :
mode === 'BICYCLE' ? 14 :
mode === 'DRIVE' ? 24 :
18;

const movingSeconds = (distanceMeters / 1000 / speedKmH) * 3600;
const operationalBufferSeconds = mode === 'WALK' ? 180 : 240;

return Math.max(60, Math.round(movingSeconds + operationalBufferSeconds));
}

function routeDistanceMeters(origin: RoutePoint, destination: RoutePoint, waypoints: RoutePoint[]): number {
const points = [origin, ...waypoints, destination];

let total = 0;
for (let i = 0; i < points.length - 1; i += 1) {
total += haversineMeters(points[i], points[i + 1]);
}

return Math.max(1, Math.round(total));
}

function parseGoogleDurationSeconds(value: unknown): number | null {
if (typeof value === 'string') {
const match = value.match(/^([0-9.]+)s$/);
if (!match) return null;
const seconds = Number(match[1]);
return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);

return null;
}

@Injectable()
export class RoutesPreviewService {
async preview(input: RoutePreviewInput = {}): Promise<RoutePreviewResponse> {
const origin = normalizePoint(input.origin);
const destination = normalizePoint(input.destination);
const waypoints = Array.isArray(input.waypoints)
? input.waypoints.map(normalizePoint).filter((item): item is RoutePoint => Boolean(item))
: [];
const mode = normalizeMode(input.mode);
const source = typeof input.source === 'string' && input.source.trim() ? input.source.trim() : DEFAULT_SOURCE;
const orderId = typeof input.orderId === 'string' && input.orderId.trim() ? input.orderId.trim() : null;

if (!origin || !destination) {
return this.fallback({
origin: origin || { lat: 0, lng: 0 },
destination: destination || { lat: 0, lng: 0 },
waypoints,
mode,
source,
orderId,
provider: 'fallback_invalid_input',
reason: 'invalid_origin_or_destination',
confidence: 0.2,
});
}

const apiKey = this.googleApiKey();

if (!apiKey) {
return this.fallback({
origin,
destination,
waypoints,
mode,
source,
orderId,
provider: 'fallback_haversine',
reason: 'missing_google_routes_api_key',
confidence: 0.68,
});
}

try {
const google = await this.computeWithGoogle({ apiKey, origin, destination, waypoints, mode });

if (google) {
const etaMinutes = Math.max(1, Math.round(google.durationSeconds / 60));

return {
ok: true,
provider: 'google_routes',
distanceMeters: google.distanceMeters,
durationSeconds: google.durationSeconds,
etaMinutes,
polyline: google.polyline,
confidence: 0.9,
fallback: false,
meta: {
trafficAware: true,
computedAt: new Date().toISOString(),
mode,
source,
orderId,
},
};
}
} catch {
// Redacted by design: no key, URL or provider payload is logged.
}

return this.fallback({
origin,
destination,
waypoints,
mode,
source,
orderId,
provider: 'fallback_google_unavailable',
reason: 'google_routes_unavailable',
confidence: 0.62,
});
}

private googleApiKey(): string {
const raw =
process.env.GOOGLE_ROUTES_API_KEY ||
process.env.GOOGLE_MAPS_API_KEY ||
process.env.GOOGLE_API_KEY ||
'';

return String(raw || '').trim();
}

private fallback(args: {
origin: RoutePoint;
destination: RoutePoint;
waypoints: RoutePoint[];
mode: RouteTravelMode;
source: string;
orderId: string | null;
provider: RouteProvider;
reason: string;
confidence: number;
}): RoutePreviewResponse {
const distanceMeters = routeDistanceMeters(args.origin, args.destination, args.waypoints);
const durationSeconds = estimateDurationSeconds(distanceMeters, args.mode);
const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

return {
ok: args.provider !== 'fallback_invalid_input',
provider: args.provider,
distanceMeters,
durationSeconds,
etaMinutes,
polyline: null,
confidence: clamp(args.confidence),
fallback: true,
meta: {
trafficAware: false,
computedAt: new Date().toISOString(),
mode: args.mode,
source: args.source,
reason: args.reason,
orderId: args.orderId,
},
};
}

private async computeWithGoogle(args: {
apiKey: string;
origin: RoutePoint;
destination: RoutePoint;
waypoints: RoutePoint[];
mode: RouteTravelMode;
}): Promise<{ distanceMeters: number; durationSeconds: number; polyline: string | null } | null> {
const fetchFn = (globalThis as any).fetch;
const AbortControllerCtor = (globalThis as any).AbortController;

if (typeof fetchFn !== 'function') return null;

const controller = typeof AbortControllerCtor === 'function' ? new AbortControllerCtor() : null;
const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;

const body: any = {
origin: {
location: {
latLng: {
latitude: args.origin.lat,
longitude: args.origin.lng,
},
},
},
destination: {
location: {
latLng: {
latitude: args.destination.lat,
longitude: args.destination.lng,
},
},
},
travelMode: args.mode,
routingPreference: args.mode === 'DRIVE' ? 'TRAFFIC_AWARE' : undefined,
computeAlternativeRoutes: false,
polylineQuality: 'OVERVIEW',
polylineEncoding: 'ENCODED_POLYLINE',
units: 'METRIC',
};

if (args.waypoints.length) {
body.intermediates = args.waypoints.map((point) => ({
location: {
latLng: {
latitude: point.lat,
longitude: point.lng,
},
},
}));
}

try {
const response = await fetchFn(GOOGLE_ROUTES_ENDPOINT, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'X-Goog-Api-Key': args.apiKey,
'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
},
body: JSON.stringify(body),
signal: controller?.signal,
});

if (!response || !response.ok) return null;

const data = await response.json();
const route = Array.isArray(data?.routes) ? data.routes[0] : null;
if (!route) return null;

const distanceMeters = toNumber(route.distanceMeters);
const durationSeconds = parseGoogleDurationSeconds(route.duration);
const polyline =
typeof route?.polyline?.encodedPolyline === 'string'
? route.polyline.encodedPolyline
: null;

if (!distanceMeters || !durationSeconds) return null;

return {
distanceMeters: Math.max(1, Math.round(distanceMeters)),
durationSeconds: Math.max(1, Math.round(durationSeconds)),
polyline,
};
} finally {
if (timer) clearTimeout(timer);
}
}
}
