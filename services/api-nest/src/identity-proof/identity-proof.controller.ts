import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IdentityProofService } from './identity-proof.service';

@Controller('identity-proof')
export class IdentityProofController {
  constructor(private readonly identityProof: IdentityProofService) {}

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
    return this.identityProof.health();
  }

  @Post('start')
  start(@Body() body: any, @Req() req: any) {
    return this.identityProof.start(body || {}, this.requesterKey(req));
  }

  @Post('check')
  check(@Body() body: any, @Req() req: any) {
    return this.identityProof.check(body || {}, this.requesterKey(req));
  }

  @Post('attest')
  attest(@Body() body: any, @Req() req: any) {
    return this.identityProof.attest(body || {}, this.requesterKey(req));
  }
}
