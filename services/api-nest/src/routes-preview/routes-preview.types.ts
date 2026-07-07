export type RouteTravelMode = 'DRIVE' | 'TWO_WHEELER' | 'BICYCLE' | 'WALK';

export type RouteProvider =
| 'google_routes'
| 'fallback_haversine'
| 'fallback_google_unavailable'
| 'fallback_invalid_input';

export interface RoutePoint {
lat: number;
lng: number;
label?: string;
}

export interface RoutePreviewInput {
origin?: Partial<RoutePoint> | null;
destination?: Partial<RoutePoint> | null;
waypoints?: Array<Partial<RoutePoint>> | null;
mode?: RouteTravelMode | string | null;
orderId?: string | null;
source?: string | null;
}

export interface RoutePreviewMeta {
trafficAware: boolean;
computedAt: string;
mode: RouteTravelMode;
source: string;
reason?: string;
orderId?: string | null;
}

export interface RoutePreviewResponse {
ok: boolean;
provider: RouteProvider;
distanceMeters: number;
durationSeconds: number;
etaMinutes: number;
polyline: string | null;
confidence: number;
fallback: boolean;
meta: RoutePreviewMeta;
}
