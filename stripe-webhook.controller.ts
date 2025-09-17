import { Controller, Post, Req, Headers, BadRequestException, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrdersService } from '../services/orders.service';

/**
 * Webhook controller to handle Stripe events. This endpoint must be configured
 * with the raw body parser and will verify the incoming signature against
 * the configured webhook secret.
 */
@Controller('webhooks')
export class StripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(secretKey!, {
      apiVersion: '2023-08-16',
    });
  }

  /**
   * Handle Stripe webhook events. The `@Req()` must expose the raw body as
   * `req.rawBody`. See main.ts for how to enable this globally using
   * express.raw({ type: 'application/json' }).
   */
  @Post('stripe')
  @HttpCode(200)
  async handleStripeEvents(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret!,
      );
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.ordersService.handlePaymentIntentSucceeded(pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.ordersService.handlePaymentIntentFailed(pi);
        break;
      }
      // Handle additional event types here (e.g. refunds, disputes)
      default:
        // Unhandled event type
        break;
    }
    return { received: true };
  }
}