import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { RawBodyRequest } from '@nestjs/common'
import { PaymentService } from './payment.service'

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}
  @Post('intent')
  async createIntent(@Body() body: { orderId: string; amountCents: number; currency?: string }) {
    return this.payments.createIntent(body.orderId, body.amountCents, body.currency || 'EUR')
  }
}

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly payments: PaymentService) {}
  @Post()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') sig?: string
  ) {
    try {
      const out = await this.payments.handleWebhook(sig, req.rawBody as Buffer)
      res.status(200).json(out)
    } catch (e) {
      res.status(400).send('Webhook Error')
    }
  }
}
