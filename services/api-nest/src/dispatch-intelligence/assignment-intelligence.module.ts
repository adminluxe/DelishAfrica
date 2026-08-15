import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersAuthGuard } from '../orders/orders.auth.guard';
import { OrdersModule } from '../orders/orders.module';
import { AssignmentIntelligenceController } from './assignment-intelligence.controller';
import { AssignmentIntelligenceService } from './assignment-intelligence.service';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [AssignmentIntelligenceController],
  providers: [AssignmentIntelligenceService, OrdersAuthGuard],
  exports: [AssignmentIntelligenceService],
})
export class AssignmentIntelligenceModule {}
