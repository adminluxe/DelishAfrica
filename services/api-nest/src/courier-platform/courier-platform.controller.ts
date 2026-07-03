import { Controller, Get } from '@nestjs/common';
import { CourierPlatformService } from './courier-platform.service';

@Controller(['couriers', 'api/couriers'])
export class CourierPlatformController {
  constructor(private readonly svc: CourierPlatformService) {}

  @Get()
  couriers() {
    return { ok: true, data: this.svc.getCouriers() };
  }

  @Get('me')
  me() {
    return { ok: true, data: this.svc.getMe() };
  }
}
