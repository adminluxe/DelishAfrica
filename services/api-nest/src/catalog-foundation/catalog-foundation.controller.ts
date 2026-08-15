import { Controller, Get } from '@nestjs/common';
import { CatalogFoundationService } from './catalog-foundation.service';

@Controller('catalog-foundation')
export class CatalogFoundationController {
  constructor(private readonly catalogFoundation: CatalogFoundationService) {}

  @Get('health')
  health() {
    return this.catalogFoundation.health();
  }
}
