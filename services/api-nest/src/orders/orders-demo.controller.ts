import { Controller, Post } from '@nestjs/common';
import { resetDemoOrders } from './orders.demo.store';

@Controller('orders/_demo')
export class OrdersDemoController {
  @Post('reset')
  reset() {
    resetDemoOrders();

    return {
      ok: true,
      message: 'demo reset ok',
      count: 0,
      orders: [],
      items: [],
      data: [],
    };
  }
}

export class OrdersDemoApiController extends OrdersDemoController {}

export class OrdersDemoV1Controller extends OrdersDemoController {}
