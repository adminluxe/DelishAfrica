import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogFoundationModule } from '../catalog-foundation/catalog-foundation.module';
import { OrderPolicyModule } from '../order-policy/order-policy.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersAccessService } from './orders.access.service';
import { CourierPresenceService } from './courier-presence.service';
import { OrdersDispatchService } from './orders.dispatch.service';
import { OrdersAuthGuard } from './orders.auth.guard';
import { OrdersController } from './orders.controller';
import { OrdersLiveLocationController } from './orders.live-location.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, CatalogFoundationModule, OrderPolicyModule, PaymentsModule],
  controllers: [OrdersController, OrdersLiveLocationController],
  providers: [OrdersService, OrdersAuthGuard, OrdersAccessService, CourierPresenceService, OrdersDispatchService],
  exports: [OrdersService, OrdersAuthGuard, OrdersAccessService, CourierPresenceService, OrdersDispatchService],
})
export class OrdersModule {}
