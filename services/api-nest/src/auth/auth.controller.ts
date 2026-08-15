import { Body, Controller, Get, Headers, Post, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('health')
  health() {
    return this.auth.health();
  }

  @Get('trusted-identity/health')
  trustedIdentityHealth() {
    return this.auth.trustedIdentityHealth();
  }

  @Post('dev-login')
  devLogin(@Body() body: any) {
    if (process.env.DA_ENABLE_DEV_LOGIN !== '1') {

      throw new ForbiddenException({ ok: false, code: 'dev_login_disabled' });

    }

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
