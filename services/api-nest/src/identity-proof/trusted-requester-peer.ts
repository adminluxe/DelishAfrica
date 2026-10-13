import { isIP } from 'node:net';

/**
 * One consistent, non-spoofable rate-limit origin for identity proofs and
 * Client enrollment.
 *
 * Never read CF-Connecting-IP / X-Forwarded-For from a request here: these
 * headers are attacker-controlled unless the complete ingress and trusted
 * proxy chain is positively validated. This function intentionally uses the
 * immediate socket peer. Destination-specific throttling still applies when
 * many devices legitimately share a proxy address.
 *
 * A trusted-proxy implementation may replace this only with explicit,
 * independently tested ingress configuration and spoofed-header rejection.
 */
export function trustedRequesterPeer(
  req: { socket?: { remoteAddress?: unknown } } | null | undefined,
): string {
  const address = req?.socket?.remoteAddress;
  if (typeof address !== 'string') return 'ip:unknown';
  const input = address.trim().toLowerCase();
  const normalized = input.startsWith('::ffff:') ? input.slice(7) : input;
  return isIP(normalized) ? 'ip:' + normalized : 'ip:unknown';
}
