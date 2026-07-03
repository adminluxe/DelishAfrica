import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('health')
  health() {
    return this.auth.health();
  }

  @Post('dev-login')
  devLogin(@Body() body: any) {
    return this.auth.devLogin(body || {});
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.meFromAuthorization(authorization);
  }

  @Post('verify')
  verify(@Body() body: any) {
    return this.auth.verify(body || {});
  }
}
