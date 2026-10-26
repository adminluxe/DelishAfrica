import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IdentityProofService } from './identity-proof.service';
import { trustedRequesterIdentity } from '../requester-identity/trusted-requester-identity';

@Controller('identity-proof')
export class IdentityProofController {
  constructor(private readonly identityProof: IdentityProofService) {}

  @Get('health')
  health() {
    return this.identityProof.health();
  }

  @Post('start')
  start(@Body() body: any, @Req() req: any) {
    return this.identityProof.start(body || {}, trustedRequesterIdentity(req));
  }

  @Post('check')
  check(@Body() body: any, @Req() req: any) {
    return this.identityProof.check(body || {}, trustedRequesterIdentity(req));
  }

  @Post('attest')
  attest(@Body() body: any, @Req() req: any) {
    return this.identityProof.attest(body || {}, trustedRequesterIdentity(req));
  }
}
