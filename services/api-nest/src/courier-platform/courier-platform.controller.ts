import { Controller, Get } from '@nestjs/common';
import { CourierPlatformService } from './courier-platform.service';

/**
 * On colle au pattern actuel:
 * - API a un prefix /api
 * - et les routes v1 existent déjà (ex: /api/v1/health)
 * Donc ici: /api/v1/...
 */
@Controller('v1')
export class CourierPlatformController {
  constructor(private readonly svc: CourierPlatformService) {}

  @Get('couriers')
  couriers() {
    return { ok: true, data: this.svc.getCouriers() };
  }

  @Get('couriers/me')
  me() {
    return { ok: true, data: this.svc.getMe() };
  }

  @Get('dispatch/active')
  activeDispatch() {
    return { ok: true, data: this.svc.getActiveDispatch() };
  }

  @Get('missions')
  missions() {
    return { ok: true, data: this.svc.getMissions() };
  }
}
