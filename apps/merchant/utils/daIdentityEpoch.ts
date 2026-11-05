let generation = 0;
const listeners = new Set<() => void>();
export function daMerchantIdentityEpoch(): number { return generation; }
export function daOnMerchantIdentityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function daAdvanceMerchantIdentity(): number {
  generation += 1;
  for (const listener of listeners) { try { listener(); } catch { /* one screen cannot block logout */ } }
  return generation;
}
export function daAssertMerchantIdentity(expected: number): void {
  if (expected !== generation) throw new Error('merchant_identity_changed');
}
