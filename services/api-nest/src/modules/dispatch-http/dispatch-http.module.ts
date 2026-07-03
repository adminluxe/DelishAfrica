import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { DispatchHttpController } from './dispatch-http.controller';
import { MissionsHttpController } from './missions-http.controller';

@Module({
  imports: [OrdersModule],
  controllers: [DispatchHttpController, MissionsHttpController],
})
export class DispatchHttpModule {}
