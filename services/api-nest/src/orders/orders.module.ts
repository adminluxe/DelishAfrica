import { Module } from '@nestjs/common';
import {
  OrdersDemoController,
  OrdersDemoApiController,
  OrdersDemoV1Controller,
} from './orders-demo.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  OrdersDemoFlowController,
  OrdersDemoFlowApiController,
  OrdersDemoFlowUnderscoreController,
  OrdersDemoFlowUnderscoreApiController,
} from './orders.demo.flow.controller';

@Module({
  controllers: [
    OrdersController,
    OrdersDemoController,
    OrdersDemoApiController,
    OrdersDemoV1Controller,
    OrdersDemoFlowController,
    OrdersDemoFlowApiController,
    OrdersDemoFlowUnderscoreController,
    OrdersDemoFlowUnderscoreApiController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
