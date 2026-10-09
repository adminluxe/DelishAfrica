import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createGuestCheckoutCapability,
  loadGuestCapabilityKey,
} from './guest-capability';

/**
 * Safe, non-production preview: mints a short-lived guest capability.
 * No payment/order endpoints are opened by this stage.
 */
@Injectable()
export class GuestSessionService {
  private readonly attempts = new Map<string, { count: number; until: number }>();

  isPreviewEnabled(): boolean {
    return process.env.NODE_ENV !== 'production'
      && process.env.DA_GUEST_CHECKOUT_PREVIEW === '1'
      && Boolean(loadGuestCapabilityKey(process.env.DA_GUEST_CHECKOUT_HMAC_KEY_B64));
  }

  status() {
    return {
      ok: true,
      stage: 'signed_guest_session_preview_v1',
      enabled: this.isPreviewEnabled(),
      paymentsEnabled: false,
      orderCreationEnabled: false,
      productionReady: false,
    };
  }

  createPreviewSession(ip?: string) {
    const secret = loadGuestCapabilityKey(process.env.DA_GUEST_CHECKOUT_HMAC_KEY_B64);
    if (!this.isPreviewEnabled() || !secret) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'guest_checkout_not_yet_enabled',
      });
    }

    const now = Date.now();
    const source = String(ip || 'unknown').slice(0, 128);
    const key = source || 'unknown';
    const previous = this.attempts.get(key);
    const window = previous && previous.until > now
      ? previous
      : { count: 0, until: now + 60 * 60 * 1000 };
    if (window.count >= 8) {
      throw new HttpException({ ok: false, code: 'guest_preview_rate_limited' }, 429);
    }
    window.count++;
    this.attempts.set(key, window);

    // Bounded memory for this single-process DEV limiter; production requires
    // persistent shared limits + abuse monitoring before enabling guest checkout.
    if (this.attempts.size > 1000) {
      for (const [candidate, value] of this.attempts) {
        if (value.until <= now) this.attempts.delete(candidate);
      }
      if (this.attempts.size > 1000) this.attempts.clear();
    }

    const capability = createGuestCheckoutCapability(secret, now);
    return {
      ok: true,
      stage: 'preview_only_no_payments',
      ...capability,
    };
  }
}
