import { createHash } from 'node:crypto';
import { CountryPayPolicy } from './courier-payroll.types';

export interface SealedCountryPayPolicy {
  policy: CountryPayPolicy;
  policyHash: string;
  sealedAt: string;
  sealedBy: string;
}

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalizeJson).join(',') + ']';
  }
  const object = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalizeJson(object[key]))
      .join(',') +
    '}'
  );
}

export function stableJsonHash(value: unknown): string {
  return createHash('sha256').update(canonicalizeJson(value), 'utf8').digest('hex');
}

export function countryPayPolicyHash(policy: CountryPayPolicy): string {
  return stableJsonHash(policy);
}

export function sealCountryPayPolicy(
  policy: CountryPayPolicy,
  sealedAt: string,
  sealedBy: string,
): SealedCountryPayPolicy {
  if (!policy.policyId.trim()) throw new Error('COURIER_POLICY_ID_REQUIRED');
  if (!sealedBy.trim()) throw new Error('COURIER_POLICY_SEALER_REQUIRED');
  if (!Number.isFinite(Date.parse(sealedAt))) {
    throw new Error('COURIER_POLICY_SEALED_AT_INVALID');
  }
  return {
    policy: JSON.parse(JSON.stringify(policy)) as CountryPayPolicy,
    policyHash: countryPayPolicyHash(policy),
    sealedAt,
    sealedBy,
  };
}

export function assertSealedPolicyIntegrity(
  sealed: SealedCountryPayPolicy,
): void {
  if (countryPayPolicyHash(sealed.policy) !== sealed.policyHash) {
    throw new Error('COURIER_POLICY_HASH_MISMATCH');
  }
}

export function assertPolicyTransition(
  previous: SealedCountryPayPolicy,
  next: SealedCountryPayPolicy,
): void {
  assertSealedPolicyIntegrity(previous);
  assertSealedPolicyIntegrity(next);

  if (previous.policy.policyId === next.policy.policyId) {
    if (previous.policyHash !== next.policyHash) {
      throw new Error('COURIER_POLICY_IMMUTABLE_VERSION_MUTATED');
    }
    return;
  }

  if (
    previous.policy.countryCode !== next.policy.countryCode ||
    previous.policy.workerStatus !== next.policy.workerStatus
  ) {
    throw new Error('COURIER_POLICY_TRANSITION_SCOPE_CHANGED');
  }
}
