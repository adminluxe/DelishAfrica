import { Controller, Get, Post } from '@nestjs/common';

class OrdersDemoBase {
  @Post('reset')
  reset() {
    return { ok: true, message: 'demo reset ok' };
  }

  @Get('health')
  health() {
    return { ok: true, message: 'demo health ok' };
  }
}

@Controller('orders/demo')
export class OrdersDemoController extends OrdersDemoBase {}

@Controller('api/orders/demo')
export class OrdersDemoApiController extends OrdersDemoBase {}

@Controller('api/v1/orders/demo')
export class OrdersDemoV1Controller extends OrdersDemoBase {}
