import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderPolicyModule } from '../order-policy/order-policy.module';
import { PaymentsAuthGuard } from './payments.auth.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, OrderPolicyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsAuthGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
