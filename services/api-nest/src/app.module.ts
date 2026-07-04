import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OrdersModule } from './orders/orders.module';
import { DispatchHttpModule } from './modules/dispatch-http/dispatch-http.module';
import { CourierPlatformModule } from './courier-platform/courier-platform.module';
import { PaymentsModule } from './payments/payments.module';
import { StripeWebhookModule } from './stripe/stripe-webhook.module';
import { AuthModule } from './auth/auth.module';
import { AssignmentIntelligenceModule } from './dispatch-intelligence/assignment-intelligence.module';

@Module({
  imports: [
    AssignmentIntelligenceModule,
    OrdersModule,
    DispatchHttpModule,
    CourierPlatformModule,
    PaymentsModule,
    StripeWebhookModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
