import { Controller, Get, NotFoundException, Patch } from '@nestjs/common';

@Controller(['/missions', '/api/missions'])
export class MissionsHttpController {
  private retired(): never {
    throw new NotFoundException({
      ok: false,
      code: 'legacy_missions_surface_retired',
    });
  }

  @Get()
  list(): never {
    return this.retired();
  }

  @Patch(':id/accept')
  accept(): never {
    return this.retired();
  }

  @Patch(':id/pickup')
  pickup(): never {
    return this.retired();
  }

  @Patch(':id/delivered')
  delivered(): never {
    return this.retired();
  }
}
