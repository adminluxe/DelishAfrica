import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [StripeWebhookController],
})
export class StripeWebhookModule {}
