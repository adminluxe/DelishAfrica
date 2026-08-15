import * as Location from 'expo-location';
import {
  daDescribeLocationError,
  daResolveTerritory,
  type DaTerritoryContext,
} from './daTrustNetwork';

export type DaTerritoryTruthCode =
  | 'resolved'
  | 'services_disabled'
  | 'permission_denied'
  | 'position_timeout'
  | 'position_unavailable'
  | 'provider_unauthorized'
  | 'provider_unavailable'
  | 'outside_coverage'
  | 'territory_unresolved';

export type DaTerritoryTruthResult = {
  ok: boolean;
  code: DaTerritoryTruthCode;
  message: string;
  permission: string;
  servicesEnabled: boolean;
  accuracyMeters: number | null;
  coordinateBand: string | null;
  locality: string | null;
  countryCode: string | null;
  context: DaTerritoryContext | null;
  checkedAt: string;
};

function timeout<T>(promise: Promise<T>, waitMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('position_timeout')), waitMs)),
  ]);
}

function classify(error: unknown): { code: DaTerritoryTruthCode; message: string } {
  const raw = String((error as any)?.message || error || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthor')) {
    return { code: 'provider_unauthorized', message: 'Le service de territoire refuse momentanément la vérification.' };
  }
  if (lower.includes('timeout')) return { code: 'position_timeout', message: 'La position précise a dépassé le délai de réponse.' };
  if (lower.includes('couverte') || lower.includes('coverage') || lower.includes('unsupported') || lower.includes('non résolu')) {
    return { code: 'outside_coverage', message: 'La position est lisible, mais aucune zone couverte n’a été confirmée.' };
  }
  try {
    const described = daDescribeLocationError(error) as any;
    if (described?.blocked) return { code: 'provider_unavailable', message: String(described.message || 'Le fournisseur de territoire est indisponible.') };
    if (described?.message) return { code: 'territory_unresolved', message: String(described.message) };
  } catch {
    // Generic classification below.
  }
  return { code: 'territory_unresolved', message: raw || 'Le territoire n’a pas pu être confirmé.' };
}

function band(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

export async function daProbeTerritoryTruth(options: { requestPermission?: boolean } = {}): Promise<DaTerritoryTruthResult> {
  const checkedAt = new Date().toISOString();
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
  if (!servicesEnabled) {
    return { ok: false, code: 'services_disabled', message: 'Activez les services de localisation iOS.', permission: 'unknown', servicesEnabled, accuracyMeters: null, coordinateBand: null, locality: null, countryCode: null, context: null, checkedAt };
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && options.requestPermission && permission.canAskAgain !== false) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    return { ok: false, code: 'permission_denied', message: 'Autorisez la localisation précise lorsque l’app est active.', permission: permission.status, servicesEnabled, accuracyMeters: null, coordinateBand: null, locality: null, countryCode: null, context: null, checkedAt };
  }

  let position: Location.LocationObject | null = null;
  try {
    position = await timeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000);
  } catch {
    position = await Location.getLastKnownPositionAsync({ maxAge: 180000, requiredAccuracy: 2000 }).catch(() => null);
  }
  if (!position) {
    return { ok: false, code: 'position_unavailable', message: 'iOS n’a fourni aucune position exploitable. Sortez quelques instants puis réessayez.', permission: permission.status, servicesEnabled, accuracyMeters: null, coordinateBand: null, locality: null, countryCode: null, context: null, checkedAt };
  }

  const latitude = Number(position.coords.latitude);
  const longitude = Number(position.coords.longitude);
  const accuracyMeters = Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy) : null;
  let locality: string | null = null;
  let countryCode: string | null = null;
  try {
    const reverse = await timeout(Location.reverseGeocodeAsync({ latitude, longitude }), 8000);
    const first = reverse[0];
    locality = String(first?.city || first?.subregion || first?.region || '').trim() || null;
    countryCode = String(first?.isoCountryCode || '').trim().toUpperCase() || null;
  } catch {
    // Reverse geocoding is diagnostic only and never invents coverage.
  }

  try {
    const context = await timeout(daResolveTerritory(latitude, longitude), 12000);
    if (!context?.territory?.city || !context?.territory?.country) throw new Error('territory_unresolved');
    return {
      ok: true,
      code: 'resolved',
      message: `${context.territory.city} · ${context.territory.country}`,
      permission: permission.status,
      servicesEnabled,
      accuracyMeters,
      coordinateBand: band(latitude, longitude),
      locality,
      countryCode,
      context,
      checkedAt,
    };
  } catch (error) {
    const state = classify(error);
    return {
      ok: false,
      code: state.code,
      message: state.message,
      permission: permission.status,
      servicesEnabled,
      accuracyMeters,
      coordinateBand: band(latitude, longitude),
      locality,
      countryCode,
      context: null,
      checkedAt,
    };
  }
}
