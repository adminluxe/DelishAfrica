import { Controller, Post, Get } from '@nestjs/common';

@Controller('api/v1/orders/demo')
export class OrdersDemoController {
  @Post('reset')
  reset() {
    // Minimal unblock: répond 200 OK.
    // (On pourra ensuite implémenter un vrai reset DB si besoin.)
    return { ok: true, message: 'demo reset ok' };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
