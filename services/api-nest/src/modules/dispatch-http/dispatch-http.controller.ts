import { Controller, Get, NotFoundException } from '@nestjs/common';

@Controller(['/dispatch', '/api/dispatch'])
export class DispatchHttpController {
  private retired(): never {
    throw new NotFoundException({
      ok: false,
      code: 'legacy_dispatch_surface_retired',
    });
  }

  @Get('active')
  active(): never {
    return this.retired();
  }
}
