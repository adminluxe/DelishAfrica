import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ClientEnrollmentService } from './client-enrollment.service';
import { trustedRequesterIdentity } from '../requester-identity/trusted-requester-identity';

@Controller('client-enrollment')
export class ClientEnrollmentController {
  constructor(private readonly enrollment: ClientEnrollmentService) {}

  @Get('readiness')
  readiness() {
    return this.enrollment.readiness();
  }

  @Post('register')
  register(@Body() body: Record<string, unknown>, @Req() req: any) {
    // Same verified requester identity for proof rate limits and reservation HMAC.
    return this.enrollment.register(body || {}, trustedRequesterIdentity(req));
  }
}
