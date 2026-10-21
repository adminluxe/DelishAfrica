import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { IdentityLifecycleService } from './identity-lifecycle.service';

@Controller('account-deletion')
export class IdentityLifecycleController {
  constructor(private readonly lifecycle: IdentityLifecycleService) {}

  @Get('health')
  health() {
    return this.lifecycle.health();
  }

  @Get('requests/:application/me')
  mine(
    @Param('application') application: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.lifecycle.mine({ application, authorization });
  }

  @Post('requests/:application')
  @HttpCode(202)
  request(
    @Param('application') application: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.lifecycle.requestDeletion({
      application,
      authorization,
      idempotencyKey,
      body,
    });
  }
}
