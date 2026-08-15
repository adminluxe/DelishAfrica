import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PaymentsAuthGuard } from './payments.auth.guard';
import { PaymentsService } from './payments.service';
import type { PaymentsRequest } from './payments.types';

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
  @UseGuards(PaymentsAuthGuard)
  createIntent(
    @Req() request: PaymentsRequest,
    @Body() body: Record<string, any> = {},
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!request.daPaymentsPrincipal) {
      throw new UnauthorizedException({ ok: false, code: 'payments_principal_missing' });
    }
    return this.payments.createPaymentIntent(
      body,
      idempotencyKey,
      request.daPaymentsPrincipal,
    );
  }
}
