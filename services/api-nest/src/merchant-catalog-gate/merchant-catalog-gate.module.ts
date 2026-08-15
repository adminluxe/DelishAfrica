import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogFoundationModule } from '../catalog-foundation/catalog-foundation.module';
import {
  MerchantCatalogGateHealthController,
  MerchantCatalogReadController,
  MerchantMembershipController,
} from './merchant-catalog-gate.controller';
import { MerchantCatalogOwnershipGuard } from './merchant-catalog-gate.guard';
import { MerchantCatalogGateService } from './merchant-catalog-gate.service';

@Module({
  imports: [AuthModule, CatalogFoundationModule],
  controllers: [
    MerchantCatalogGateHealthController,
    MerchantCatalogReadController,
    MerchantMembershipController,
  ],
  providers: [MerchantCatalogOwnershipGuard, MerchantCatalogGateService],
})
export class MerchantCatalogGateModule {}
