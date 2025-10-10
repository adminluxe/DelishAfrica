import { Module } from '@nestjs/common'
import { PaymentController, StripeWebhookController } from './payment.controller'
import { PaymentService } from './payment.service'

@Module({
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
