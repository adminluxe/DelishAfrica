import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { GuestSessionService } from './guest-session.service';

type HttpRequest = { ip?: string };

@Controller('guest-checkout')
export class GuestSessionController {
  constructor(private readonly guest: GuestSessionService) {}

  @Get('health')
  health() {
    return this.guest.status();
  }

  @Post('preview-session')
  @HttpCode(201)
  previewSession(@Req() request: HttpRequest) {
    // Development-only API; this does not authorise payment or order routes.
    return this.guest.createPreviewSession(request.ip);
  }
}
