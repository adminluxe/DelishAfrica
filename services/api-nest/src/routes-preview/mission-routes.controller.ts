import { BadRequestException, Body, Controller, ForbiddenException, Headers, HttpCode, HttpException, Post, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { RoutesPreviewService } from './routes-preview.service';
import type { RoutePoint, RouteTravelMode } from './routes-preview.types';

/** Authenticated routing for the delivery map. No order state is read or changed. */
@Controller('routes')
export class MissionRoutesController {
  private minute = -1;
  private day = '';
  private dailyCount = 0;
  private minuteCount = 0;
  private actors = new Map<string, number>();

  constructor(private readonly auth: AuthService, private readonly routes: RoutesPreviewService) {}

  private point(value: any): RoutePoint | null {
    if (!value || typeof value.lat !== 'number' || typeof value.lng !== 'number') return null;
    if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng) || Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) return null;
    return { lat: value.lat, lng: value.lng };
  }

  private limit(key: string) {
    const time = Date.now();
    const minute = Math.floor(time / 60_000);
    const day = new Date(time).toISOString().slice(0, 10);
    if (minute !== this.minute) { this.minute = minute; this.minuteCount = 0; this.actors.clear(); }
    if (day !== this.day) { this.day = day; this.dailyCount = 0; }
    if ((this.actors.get(key) || 0) >= 8 || this.minuteCount >= 60 || this.dailyCount >= 500) {
      throw new HttpException({ ok: false, error: 'mission_route_temporarily_limited' }, 429);
    }
    this.actors.set(key, (this.actors.get(key) || 0) + 1);
    this.minuteCount += 1;
    this.dailyCount += 1;
  }

  @Post('mission-preview')
  @HttpCode(200)
  async preview(@Headers('authorization') authorization: string | undefined, @Body() input: Record<string, any> = {}) {
    const resolution = await this.auth.resolvePrincipalFromAuthorization(authorization || '');
    const principal = resolution.ok && resolution.authenticated ? resolution.principal : null;
    if (!principal) throw new UnauthorizedException({ ok: false, error: 'authentication_required' });
    if (!principal.ownershipEligible || !['client', 'courier', 'merchant'].includes(principal.role)) {
      throw new ForbiddenException({ ok: false, error: 'verified_account_required' });
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException({ ok: false, error: "invalid_mission_route" });
    const origin = this.point(input.origin);
    const destination = this.point(input.destination);
    const mode = input.mode as RouteTravelMode;
    const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : '';
    if (!origin || !destination || !['DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK'].includes(mode) || !orderId || orderId.length > 128) {
      throw new BadRequestException({ ok: false, error: 'invalid_mission_route' });
    }
    const rawLanguage = typeof input.languageCode === "string" ? input.languageCode.trim() : "";
    const languageCode = /^[A-Za-z]{2,3}(?:-(?:[A-Za-z]{2}|[0-9]{3}))?$/.test(rawLanguage)
      ? rawLanguage : "fr";
    const key = createHash('sha256').update(`${principal.issuer}|${principal.subject}`).digest('hex');
    this.limit(key);
    return this.routes.preview({ origin, destination, mode, orderId, languageCode, source: 'mission-journey' }, { allowGoogle: true });
  }
}
