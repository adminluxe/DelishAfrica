import { Controller, Post, Req, Headers, BadRequestException, HttpCode } from "@nestjs/common";
import Stripe from "stripe";
import { OrdersService } from "./orders.service";

@Controller("webhooks")
export class StripeWebhookController {
  private readonly stripe: Stripe;
  constructor(private readonly orders: OrdersService) {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  }

  @Post("stripe")
  @HttpCode(200)
  async handleStripe(@Req() req: any, @Headers("stripe-signature") signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Signature invalide: ${err.message}`);
    }
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.orders.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await this.orders.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // ignore
        break;
    }
    return { received: true };
  }
}
