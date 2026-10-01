import { Controller, Get } from '@nestjs/common';
import { AtmosphereService } from './atmosphere.service';

@Controller('atmosphere')
export class AtmosphereController {
  constructor(private readonly atmosphere: AtmosphereService) {}

  @Get('health')
  health() {
    return this.atmosphere.health();
  }

  @Get('current')
  current() {
    return this.atmosphere.current();
  }
}
