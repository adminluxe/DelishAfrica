import { Module } from '@nestjs/common';
import { GuestSessionController } from './guest-session.controller';
import { GuestSessionService } from './guest-session.service';

/**
 * Checkout roadmap, gated stage 1. No dependency on payment/order guards.
 * Production remains sealed regardless of preview env flags.
 */
@Module({
  controllers: [GuestSessionController],
  providers: [GuestSessionService],
})
export class GuestCheckoutModule {}
