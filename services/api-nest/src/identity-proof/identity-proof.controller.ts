import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IdentityProofService } from './identity-proof.service';
import { trustedRequesterPeer } from './trusted-requester-peer';

@Controller('identity-proof')
export class IdentityProofController {
  constructor(private readonly identityProof: IdentityProofService) {}

  @Get('health')
  health() {
    return this.identityProof.health();
  }

  @Post('start')
  start(@Body() body: any, @Req() req: any) {
    return this.identityProof.start(body || {}, trustedRequesterPeer(req));
  }

  @Post('check')
  check(@Body() body: any, @Req() req: any) {
    return this.identityProof.check(body || {}, trustedRequesterPeer(req));
  }

  @Post('attest')
  attest(@Body() body: any, @Req() req: any) {
    return this.identityProof.attest(body || {}, trustedRequesterPeer(req));
  }
}
