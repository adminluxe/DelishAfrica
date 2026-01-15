import { Module } from '@nestjs/common';
import { ThieypDemoController } from './thieyp-demo.controller';
import { ThieypDemoService } from './thieyp-demo.service';
import { MenuController } from '../menu/menu.controller';
import { DemoOrdersController } from '../orders/demo-orders.controller';

@Module({
  imports: [],
  controllers: [
    ThieypDemoController,
    MenuController,
    DemoOrdersController,
  ],
  providers: [ThieypDemoService],
  exports: [ThieypDemoService],
})
export class ThieypDemoModule {}
