/**
 * DelishAfrica Client proof identity canonicalization.
 *
 * Matches the normalization used by both /identity-proof and /profile-trust
 * services. This is a LOCAL DISPLAY/VALIDITY comparator, never an authorization
 * decision: /identity-proof/attest re-verifies signed proofs on the API.
 *
 * In particular, formatting a phone as "+32 470..." instead of "+32470..."
 * MUST NOT erase its proof or reduce 3/3 to 1/3 after profile persistence.
 */
export type DaContactChannel = 'sms' | 'email';

type LocalProof = {
  token?: string | null;
  destination?: string | null;
  expiresAt?: string | null;
};

export function daCanonicalContact(channel: DaContactChannel, value: unknown): string {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, channel === 'sms' ? 40 : 254);
  if (channel === 'email') return raw.toLowerCase();
  const compact = raw.replace(/[()\s.-]/g, '');
  const international = compact.startsWith('00') ? '+' + compact.slice(2) : compact;
  return (international.startsWith('+') ? '+' : '') + international.replace(/\D/g, '');
}

/**
 * True only for the same canonical recipient and a locally unexpired token.
 * A true result is NOT sufficient to open payments / assign an account role.
 */
export function daLocalProofFresh(
  channel: DaContactChannel,
  proof: LocalProof | null | undefined,
  currentContact: unknown,
  nowMs = Date.now(),
): boolean {
  const expected = daCanonicalContact(channel, currentContact);
  const proved = daCanonicalContact(channel, proof?.destination);
  const expiresAt = Date.parse(String(proof?.expiresAt ?? ''));
  return Boolean(
    expected &&
    proved === expected &&
    typeof proof?.token === 'string' &&
    proof.token.length > 0 &&
    Number.isFinite(expiresAt) &&
    expiresAt > nowMs,
  );
}
