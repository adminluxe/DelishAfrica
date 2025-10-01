import { Controller, Get, Header } from '@nestjs/common';

@Controller('health') // => route finale: /api/health
export class HealthController {
  @Get('health')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
