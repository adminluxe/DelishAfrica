import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ClientEnrollmentService } from './client-enrollment.service';
import { trustedRequesterPeer } from '../identity-proof/trusted-requester-peer';

@Controller('client-enrollment')
export class ClientEnrollmentController {
  constructor(private readonly enrollment: ClientEnrollmentService) {}

  @Get('readiness')
  readiness() {
    return this.enrollment.readiness();
  }

  @Post('register')
  register(@Body() body: Record<string, unknown>, @Req() req: any) {
    // Match the proof service's trusted socket-peer origin. Never accept a
    // requester identity supplied directly in CF-/X-Forwarded-* headers.
    return this.enrollment.register(body || {}, trustedRequesterPeer(req));
  }
}
