// Generation changes invalidate pending reads and in-memory account caches.
let generation = 0;
export function daMerchantIdentityEpoch(): number { return generation; }
export function daAdvanceMerchantIdentity(): number { return ++generation; }
export function daAssertMerchantIdentity(epoch: number): void {
  if (epoch !== generation) throw new Error('merchant_identity_changed');
}
