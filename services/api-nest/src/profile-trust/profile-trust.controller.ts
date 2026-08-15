import { Body, Controller, Get, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ProfileTrustService } from './profile-trust.service';

@Controller('profile-trust')
export class ProfileTrustController {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly service: ProfileTrustService) {}

  @Get('health')
  health() {
    return this.service.health();
  }

  @Post('inspect')
  async inspect(@Body() body: unknown, @Req() request: any) {
    const forwarded = String(request?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const key = forwarded || String(request?.ip || request?.socket?.remoteAddress || 'unknown');
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + 60_000 });
    } else {
      current.count += 1;
      if (current.count > 30) {
        throw new HttpException('profile_trust_rate_limited', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpException('invalid_profile_trust_payload', HttpStatus.BAD_REQUEST);
    }

    return await this.service.inspect(body as Record<string, unknown>);
  }
}
