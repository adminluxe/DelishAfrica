import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { MerchantModule } from "./modules/merchant/merchant.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { DispatchGateway } from "./realtime/dispatch.gateway";

@Module({
  imports: [HealthModule, MerchantModule, OrdersModule],
  providers: [DispatchGateway]
})
export class AppModule {}
