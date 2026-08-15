import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { LocationTrustService } from './location-trust.service';

@Controller('location-trust')
export class LocationTrustController {
  constructor(private readonly locationTrust: LocationTrustService) {}

  private requesterKey(req: any): string {
    return String(
      req?.headers?.['cf-connecting-ip'] ||
        req?.headers?.['x-forwarded-for'] ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        'unknown',
    ).slice(0, 180);
  }

  @Get('health')
  health() {
    return this.locationTrust.health();
  }

  @Post('autocomplete')
  autocomplete(@Body() body: any, @Req() req: any) {
    return this.locationTrust.autocomplete(body || {}, this.requesterKey(req));
  }

  @Post('resolve')
  resolve(@Body() body: any, @Req() req: any) {
    return this.locationTrust.resolve(body || {}, this.requesterKey(req));
  }

  @Post('context')
  context(@Body() body: any, @Req() req: any) {
    return this.locationTrust.context(body || {}, this.requesterKey(req));
  }
}
