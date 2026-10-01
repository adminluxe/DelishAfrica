import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderPolicyModule } from '../order-policy/order-policy.module';
import { OrchidpayF3Module } from '../orchidpay-f3/orchidpay-f3.module';
import { FinancialStateModule } from '../financial-state/financial-state.module';
import { PaymentsAuthGuard } from './payments.auth.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, OrderPolicyModule, OrchidpayF3Module, FinancialStateModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsAuthGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
