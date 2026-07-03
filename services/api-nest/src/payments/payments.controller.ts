import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('health')
  health() {
    return this.payments.health();
  }

  @Get('providers')
  providers() {
    return this.payments.providers();
  }

  @Post('create-intent')
  createIntent(@Body() body: Record<string, any> = {}) {
    return this.payments.createPaymentIntent(body);
  }
}
