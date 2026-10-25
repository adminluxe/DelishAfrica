import { isIP } from 'node:net';

/**
 * Rate-limit attribution shared by identity proofs and Client enrollment.
 * NEVER authorize an account or a financial action using this value.
 *
 * Live API ingress already verified (R5G read-only, 2026-10-25):
 * - NestJS listens on 127.0.0.1:3010.
 * - The api.delishafrica.me HTTPS server includes da_cloudflare_realip.conf.
 * - Nginx trusts CF-Connecting-IP ONLY from pinned Cloudflare source CIDRs.
 * - Its API location overwrites X-Real-IP with verified $remote_addr.
 *
 * That deployment-specific contract is NOT assumed for arbitrary Nest hosts.
 * Default mode ignores all proxy headers and uses only the immediate socket.
 * Reviewed mode is explicitly opt-in and trusts X-Real-IP ONLY for loopback
 * sockets. Never consult X-Forwarded-For or raw CF-Connecting-IP here.
 * Enable only after checking Nginx ingress, firewall and loopback binding.
 *
 * If the trusted-proxy header is missing/malformed, return ip:unknown rather
 * than fall back to an attacker-controlled header or guessed identity.
 * The same origin must be used for start, check, attest and register.
 */

const TRUSTED_INGRESS_MODE = 'NGINX_REALIP_ON_LOOPBACK_VERIFIED';

type IngressRequest = {
  socket?: { remoteAddress?: unknown };
  headers?: Record<string, unknown>;
} | null | undefined;

function canonicalIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim().toLowerCase();
  // Header values must contain ONE bare address, never a chain or a port.
  const normalized = input.startsWith('::ffff:') ? input.slice(7) : input;
  return isIP(normalized) ? normalized : null;
}

export function trustedRequesterPeer(req: IngressRequest): string {
  const peer = canonicalIp(req?.socket?.remoteAddress);
  if (!peer) return 'ip:unknown';

  const loopback = peer === '127.0.0.1' || peer === '::1';
  const useReviewedIngress =
    process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE === TRUSTED_INGRESS_MODE;

  if (!loopback || !useReviewedIngress) return 'ip:' + peer;

  const forwarded = canonicalIp(req?.headers?.['x-real-ip']);
  return forwarded ? 'ip:' + forwarded : 'ip:unknown';
}
