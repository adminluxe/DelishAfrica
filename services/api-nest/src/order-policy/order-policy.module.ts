import { Module } from '@nestjs/common';
import { CatalogFoundationModule } from '../catalog-foundation/catalog-foundation.module';
import { CatalogOrderPolicyController } from './catalog-order-policy.controller';
import { CatalogOrderPolicyService } from './catalog-order-policy.service';

@Module({
  imports: [CatalogFoundationModule],
  controllers: [CatalogOrderPolicyController],
  providers: [CatalogOrderPolicyService],
  exports: [CatalogOrderPolicyService],
})
export class OrderPolicyModule {}
