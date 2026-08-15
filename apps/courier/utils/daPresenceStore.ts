import * as SecureStore from "expo-secure-store";
import { daAccountScopeId, daAccountStorageKey, daOrdersFetch } from "./daOrdersApi";

const CACHE_KEY = "__DELISHAFRICA_COURIER_PROFILE_LITE_V1__";
const SECURE_KEY = "delishafrica.courier.presence.v1";
const RAW_API = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1") ? RAW_API.replace(/\/$/, "") : `${RAW_API.replace(/\/$/, "")}/api/v1`;
const memory = new Map<string, object>();
let activeScope: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readCourierPresenceCache<T extends object>(): T | null {
  if (!activeScope) return null;
  const value = memory.get(activeScope);
  return isRecord(value) ? (value as T) : null;
}

function writeCourierPresenceCache<T extends object>(scope: string, profile: T | null) {
  activeScope = scope;
  if (profile) memory.set(scope, profile);
  else memory.delete(scope);
  if (profile) (globalThis as any)[`${CACHE_KEY}.${scope}`] = profile;
  else delete (globalThis as any)[`${CACHE_KEY}.${scope}`];
}

export async function loadCourierPresence<T extends object>(): Promise<T | null> {
  const scope = await daAccountScopeId();
  const cached = memory.get(scope) as T | undefined;
  try {
    if (!(await SecureStore.isAvailableAsync())) return cached || null;
    const scopedKey = await daAccountStorageKey(SECURE_KEY);
    const raw = await SecureStore.getItemAsync(scopedKey);
    if (!raw) return cached || null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return cached || null;
    writeCourierPresenceCache(scope, parsed as T);
    return parsed as T;
  } catch {
    return cached || null;
  }
}

export async function syncCourierPresence<T extends object>(profile: T): Promise<Record<string, any>> {
  const value = profile as Record<string, any>;
  const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/courier/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      available: value.available === true,
      riderName: value.riderName,
      activeZone: value.activeZone,
      city: value.territory?.city,
      countryCode: value.territory?.countryCode,
      latitude: value.territoryEvidence?.latitude,
      longitude: value.territoryEvidence?.longitude,
      vehicle: value.vehicle,
      capacity: value.capacity,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || payload?.error || `Présence serveur indisponible (${response.status}).`);
  }
  return payload;
}

export async function saveCourierPresence<T extends object>(profile: T): Promise<T> {
  const scope = await daAccountScopeId();
  const previous = memory.get(scope) as T | undefined;
  let scopedKey: string | null = null;
  let previousRaw: string | null = null;
  writeCourierPresenceCache(scope, profile);
  try {
    if (!(await SecureStore.isAvailableAsync())) throw new Error("Le stockage sécurisé de l’appareil est indisponible.");
    scopedKey = await daAccountStorageKey(SECURE_KEY);
    previousRaw = await SecureStore.getItemAsync(scopedKey);
    await SecureStore.setItemAsync(scopedKey, JSON.stringify(profile));
    const previousAvailable = Boolean((previous as any)?.available);
    const nextAvailable = Boolean((profile as any)?.available);
    try {
      await syncCourierPresence(profile);
    } catch (error) {
      if (previousAvailable !== nextAvailable || nextAvailable) throw error;
    }
    return profile;
  } catch (error) {
    writeCourierPresenceCache(scope, previous || null);
    if (scopedKey) {
      try {
        if (previousRaw === null) await SecureStore.deleteItemAsync(scopedKey);
        else await SecureStore.setItemAsync(scopedKey, previousRaw);
      } catch {
        // The UI still exposes the failure; the next hydration rechecks server truth.
      }
    }
    throw error;
  }
}

export async function clearCourierPresence() {
  const scope = await daAccountScopeId();
  writeCourierPresenceCache(scope, null);
  try {
    if (await SecureStore.isAvailableAsync()) {
      const scopedKey = await daAccountStorageKey(SECURE_KEY);
      await SecureStore.deleteItemAsync(scopedKey);
    }
  } catch {
    // Current account memory is already cleared.
  }
}
