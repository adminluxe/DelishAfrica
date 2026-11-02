import * as SecureStore from 'expo-secure-store';
import { daAccountScopeId } from './daOrdersApi';
import { daMerchantIdentityEpoch, daAssertMerchantIdentity } from './daIdentityEpoch';
const SECURE_KEY = 'delishafrica.partner.presence.v1';
const memory = new Map<string, object>();
let active: { scope: string; epoch: number } | null = null;
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function readPartnerPresenceCache<T extends object>(): T | null {
  if (!active || active.epoch !== daMerchantIdentityEpoch()) return null;
  return (memory.get(active.scope) as T) || null;
}
function write(scope: string, epoch: number, profile: object | null) {
  daAssertMerchantIdentity(epoch);
  active = { scope, epoch };
  if (profile) memory.set(scope, profile); else memory.delete(scope);
}
async function context() {
  const scope = await daAccountScopeId();
  return { scope, epoch: daMerchantIdentityEpoch(), key: SECURE_KEY + '.v3.' + scope };
}
export async function loadPartnerPresence<T extends object>(): Promise<T | null> {
  const c = await context();
  let profile: T | null = null;
  try {
    if (await SecureStore.isAvailableAsync()) {
      const raw = await SecureStore.getItemAsync(c.key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isRecord(parsed)) profile = parsed as T;
    }
  } catch { /* Only the same verified scope may be used offline. */ }
  daAssertMerchantIdentity(c.epoch);
  profile = profile || (memory.get(c.scope) as T) || null;
  write(c.scope, c.epoch, profile);
  return profile;
}
export async function savePartnerPresence<T extends object>(profile: T, expectedEpoch = daMerchantIdentityEpoch()): Promise<T> {
  daAssertMerchantIdentity(expectedEpoch);
  const c = await context();
  daAssertMerchantIdentity(expectedEpoch);
  if (!(await SecureStore.isAvailableAsync())) throw new Error('Le stockage sécurisé de l’appareil est indisponible.');
  await SecureStore.setItemAsync(c.key, JSON.stringify(profile));
  daAssertMerchantIdentity(c.epoch);
  write(c.scope, c.epoch, profile);
  return profile;
}
export async function clearPartnerPresence() {
  const c = await context();
  if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(c.key);
  write(c.scope, c.epoch, null);
}
