import { Module } from '@nestjs/common';
import { CatalogFoundationController } from './catalog-foundation.controller';
import { CatalogFoundationRepository } from './catalog-foundation.repository';
import { CatalogFoundationService } from './catalog-foundation.service';

@Module({
  controllers: [CatalogFoundationController],
  providers: [CatalogFoundationRepository, CatalogFoundationService],
  exports: [CatalogFoundationService],
})
export class CatalogFoundationModule {}
