import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import type { PaymentsRequest } from '../payments/payments.types';

@Controller('stripe')
export class StripeWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() request: PaymentsRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.handleStripeWebhook(
      request.rawBody,
      request.body || {},
      signature,
    );
  }
}
