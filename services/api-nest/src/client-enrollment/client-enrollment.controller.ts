import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ClientEnrollmentService } from './client-enrollment.service';

@Controller('client-enrollment')
export class ClientEnrollmentController {
  constructor(private readonly enrollment: ClientEnrollmentService) {}

  @Get('readiness')
  readiness() {
    return this.enrollment.readiness();
  }

  @Post('register')
  register(@Body() body: Record<string, unknown>, @Req() req: any) {
    // Do not trust arbitrary client-supplied X-Forwarded-For values.
    const requester = String(
      req?.ip || req?.socket?.remoteAddress || 'unknown',
    ).slice(0, 120);
    return this.enrollment.register(body || {}, requester);
  }
}
