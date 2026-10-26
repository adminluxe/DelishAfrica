import { isIP } from 'node:net';

/**
 * DelishAfrica R6Q: trusted requester identifier for rate-limits and proofs.
 * Nginx always overwrites X-Real-IP with $remote_addr after Cloudflare real-IP
 * verification. Nest is bound only to host loopback through Docker bridge NAT.
 * Never trust raw CF-Connecting-IP, X-Forwarded-For, or a supplied client claim.
 */
export function trustedRequesterIdentity(req: any): string {
  const rawPeer = typeof req?.socket?.remoteAddress === 'string'
    ? req.socket.remoteAddress : '';
  const peer = rawPeer.startsWith('::ffff:') ? rawPeer.slice(7) : rawPeer;
  const header = req?.headers?.['x-real-ip'];
  const ingressMode = process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
  if (
    ingressMode === 'NGINX_REALIP_ON_LOOPBACK_VERIFIED' &&
    peer === '172.19.0.1' &&
    typeof header === 'string' &&
    header.length <= 45 &&
    header === header.trim() &&
    isIP(header) !== 0
  ) {
    return header;
  }
  return peer && isIP(peer) !== 0 ? peer : 'unknown';
}
