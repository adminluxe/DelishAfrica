import { Body, Controller, Headers, Post } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhook')
  webhook(
    @Body() body: Record<string, any> = {},
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.handleStripeWebhook(body, signature);
  }
}
