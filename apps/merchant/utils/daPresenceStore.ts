import * as SecureStore from "expo-secure-store";
import { daAccountScopeId, daAccountStorageKey } from "./daOrdersApi";

const CACHE_KEY = "__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__";
const SECURE_KEY = "delishafrica.partner.presence.v1";
const memory = new Map<string, object>();
let activeScope: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readPartnerPresenceCache<T extends object>(): T | null {
  if (!activeScope) return null;
  const value = memory.get(activeScope);
  return isRecord(value) ? (value as T) : null;
}

function writePartnerPresenceCache<T extends object>(scope: string, profile: T | null) {
  activeScope = scope;
  if (profile) memory.set(scope, profile);
  else memory.delete(scope);
  if (profile) (globalThis as any)[`${CACHE_KEY}.${scope}`] = profile;
  else delete (globalThis as any)[`${CACHE_KEY}.${scope}`];
}

export async function loadPartnerPresence<T extends object>(): Promise<T | null> {
  const scope = await daAccountScopeId();
  const cached = memory.get(scope) as T | undefined;
  try {
    if (!(await SecureStore.isAvailableAsync())) return cached || null;
    const scopedKey = await daAccountStorageKey(SECURE_KEY);
    const raw = await SecureStore.getItemAsync(scopedKey);
    if (!raw) return cached || null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return cached || null;
    writePartnerPresenceCache(scope, parsed as T);
    return parsed as T;
  } catch {
    return cached || null;
  }
}

export async function savePartnerPresence<T extends object>(profile: T): Promise<T> {
  const scope = await daAccountScopeId();
  const previous = memory.get(scope) as T | undefined;
  writePartnerPresenceCache(scope, profile);
  try {
    if (!(await SecureStore.isAvailableAsync())) throw new Error("Le stockage sécurisé de l’appareil est indisponible.");
    const scopedKey = await daAccountStorageKey(SECURE_KEY);
    await SecureStore.setItemAsync(scopedKey, JSON.stringify(profile));
    return profile;
  } catch (error) {
    writePartnerPresenceCache(scope, previous || null);
    throw error;
  }
}

export async function clearPartnerPresence() {
  const scope = await daAccountScopeId();
  writePartnerPresenceCache(scope, null);
  try {
    if (await SecureStore.isAvailableAsync()) {
      const scopedKey = await daAccountStorageKey(SECURE_KEY);
      await SecureStore.deleteItemAsync(scopedKey);
    }
  } catch {
    // Current account memory is already cleared.
  }
}
