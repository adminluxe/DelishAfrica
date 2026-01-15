import { Module } from '@nestjs/common';
import { MenuController } from './menu/menu.controller';
import { DemoOrdersController } from './orders/demo-orders.controller';
import { OrdersDemoController } from './orders/orders-demo.controller';

@Module({
  imports: [],
  controllers: [MenuController, DemoOrdersController, OrdersDemoController],
  providers: [],
})
export class AppModule {}
